package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	pkg "github.com/asifulhaque087/collab-grid/services/api/internal/service/package"
)

type PackageRepository struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewPackageRepository(pool *pgxpool.Pool) *PackageRepository {
	return &PackageRepository{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

func (r *PackageRepository) ListTenantRolePermissions(ctx context.Context, slug string) ([]pkg.Permission, error) {
	rows, err := r.queries.ListTenantRolePermissions(ctx, slug)
	if err != nil {
		return nil, err
	}
	res := make([]pkg.Permission, len(rows))
	for i, row := range rows {
		res[i] = pkg.Permission{
			ID:          row.ID,
			Name:        row.Name,
			Action:      row.Action,
			Subject:     row.Subject,
			Description: row.Description,
		}
	}
	return res, nil
}

func (r *PackageRepository) ListPackages(ctx context.Context) ([]pkg.Package, error) {
	rows, err := r.queries.ListPackages(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]pkg.Package, len(rows))
	for i, row := range rows {
		res[i] = toPackage(row.ID, row.Title, row.Slug, row.Price, row.PrimaryUserID, row.SecondaryUserID, row.SubscriberCount)
	}
	return res, nil
}

func (r *PackageRepository) GetPackageByID(ctx context.Context, id pgtype.UUID) (pkg.Package, error) {
	row, err := r.queries.GetPackageByID(ctx, id)
	if err != nil {
		return pkg.Package{}, err
	}
	return toPackage(row.ID, row.Title, row.Slug, row.Price, row.PrimaryUserID, row.SecondaryUserID, row.SubscriberCount), nil
}

func (r *PackageRepository) ListPackagePermissionLimits(ctx context.Context, packageIDs []pgtype.UUID) ([]pkg.PackagePermission, error) {
	if len(packageIDs) == 0 {
		return nil, nil
	}
	rows, err := r.queries.ListPackagePermissionLimits(ctx, packageIDs)
	if err != nil {
		return nil, err
	}
	res := make([]pkg.PackagePermission, len(rows))
	for i, row := range rows {
		res[i] = pkg.PackagePermission{
			PackageID:    row.PackageID,
			PermissionID: row.PermissionID,
			Name:         row.PermissionName,
			Action:       row.PermissionAction,
			Subject:      row.PermissionSubject,
			Limit:        int4ToInt32Ptr(row.LimitCount),
		}
	}
	return res, nil
}

// CreatePackage inserts the package and its permission limits in a single transaction.
func (r *PackageRepository) CreatePackage(ctx context.Context, arg pkg.CreatePackageParams, permissions []pkg.PackagePermissionInput) (pkg.Package, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return pkg.Package{}, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	createdID, err := q.InsertPackage(ctx, sqlc.InsertPackageParams{
		Title:           arg.Title,
		Slug:            arg.Slug,
		Price:           arg.Price,
		PrimaryUserID:   arg.PrimaryUserID,
		SecondaryUserID: arg.SecondaryUserID,
	})
	if err != nil {
		return pkg.Package{}, err
	}

	for _, p := range permissions {
		if err := q.InsertPackagePermissionLimit(ctx, sqlc.InsertPackagePermissionLimitParams{
			PackageID:    createdID,
			PermissionID: p.PermissionID,
			LimitCount:   int32ToPgtypeInt4(p.Limit),
		}); err != nil {
			return pkg.Package{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return pkg.Package{}, err
	}

	return pkg.Package{
		ID:              createdID,
		Title:           arg.Title,
		Slug:            arg.Slug,
		Price:           arg.Price,
		PrimaryUserID:   arg.PrimaryUserID,
		SecondaryUserID: arg.SecondaryUserID,
	}, nil
}

// UpdatePackage applies the partial package change and replaces permission
// grants in a single transaction. A nil Permissions slice leaves grants
// untouched; a non-nil (possibly empty) slice replaces them.
func (r *PackageRepository) UpdatePackage(ctx context.Context, arg pkg.UpdatePackageParams) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	if arg.Title != nil || arg.Slug != nil || arg.Price != nil {
		if _, err := q.UpdatePackage(ctx, sqlc.UpdatePackageParams{
			ID:    arg.ID,
			Title: stringToPgtypeText(arg.Title),
			Slug:  stringToPgtypeText(arg.Slug),
			Price: stringToPgtypeText(arg.Price),
		}); err != nil {
			return err
		}
	}

	if arg.Permissions != nil {
		if err := q.DeletePackagePermissionLimits(ctx, arg.ID); err != nil {
			return err
		}
		for _, p := range *arg.Permissions {
			if err := q.InsertPackagePermissionLimit(ctx, sqlc.InsertPackagePermissionLimitParams{
				PackageID:    arg.ID,
				PermissionID: p.PermissionID,
				LimitCount:   int32ToPgtypeInt4(p.Limit),
			}); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *PackageRepository) DeletePackage(ctx context.Context, id pgtype.UUID) error {
	return r.queries.DeletePackage(ctx, id)
}

func toPackage(
	id pgtype.UUID,
	title string,
	slug string,
	price string,
	primaryUserID pgtype.UUID,
	secondaryUserID pgtype.UUID,
	subscriberCount int64,
) pkg.Package {
	return pkg.Package{
		ID:              id,
		Title:           title,
		Slug:            slug,
		Price:           price,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		SubscriberCount: subscriberCount,
	}
}

func int4ToInt32Ptr(v pgtype.Int4) *int32 {
	if !v.Valid {
		return nil
	}
	val := v.Int32
	return &val
}

func int32ToPgtypeInt4(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

func stringToPgtypeText(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *v, Valid: true}
}
