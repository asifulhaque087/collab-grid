package postgresql

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	repo "github.com/asifulhaque087/collab-grid/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
)

type Action string

const (
	ActionManage Action = "manage"
	ActionCreate Action = "create"
	ActionRead   Action = "read"
	ActionUpdate Action = "update"
	ActionDelete Action = "delete"
)

type Subjects string

const (
	SubjectsAll              Subjects = "all"
	SubjectsBoard            Subjects = "Board"
	SubjectsSmartWidget      Subjects = "SmartWidget"
	SubjectsUser             Subjects = "User"
	SubjectsRole             Subjects = "Role"
	SubjectsPackage          Subjects = "Package"
	SubjectsPermission       Subjects = "Permission"
	SubjectsPaymentHistory   Subjects = "PaymentHistory"
	SubjectsUserPlanSnapshot Subjects = "UserPlanSnapshot"
	SubjectsSubscription     Subjects = "Subscription"
)

type PermissionDefinition struct {
	Action      Action
	Subject     Subjects
	Name        string
	Description string
}

func PermissionKey(action, subject string) string {
	return fmt.Sprintf("%s:%s", action, subject)
}

var PermissionCatalog = []PermissionDefinition{
	{Action: ActionManage, Subject: SubjectsAll, Name: "Manage Everything", Description: "Full system access — conferred by the super-admin role only."},
	{Action: ActionCreate, Subject: SubjectsBoard, Name: "Create Board", Description: "Create new canvas boards."},
	{Action: ActionRead, Subject: SubjectsBoard, Name: "Read Board", Description: "View boards and their contents."},
	{Action: ActionUpdate, Subject: SubjectsBoard, Name: "Update Board", Description: "Edit board settings and metadata."},
	{Action: ActionDelete, Subject: SubjectsBoard, Name: "Delete Board", Description: "Delete boards permanently."},
	{Action: ActionCreate, Subject: SubjectsSmartWidget, Name: "Create Smart Widget", Description: "Add inventory widgets to boards."},
	{Action: ActionRead, Subject: SubjectsSmartWidget, Name: "Read Smart Widget", Description: "View widgets on canvas boards."},
	{Action: ActionUpdate, Subject: SubjectsSmartWidget, Name: "Update Smart Widget", Description: "Edit widget properties and canvas position."},
	{Action: ActionDelete, Subject: SubjectsSmartWidget, Name: "Delete Smart Widget", Description: "Remove widgets from boards."},
	{Action: ActionCreate, Subject: SubjectsUser, Name: "Create User", Description: "Create sub-users and team members."},
	{Action: ActionRead, Subject: SubjectsUser, Name: "Read User", Description: "View users and their profiles."},
	{Action: ActionUpdate, Subject: SubjectsUser, Name: "Update User", Description: "Edit user records and role assignments."},
	{Action: ActionDelete, Subject: SubjectsUser, Name: "Delete User", Description: "Remove users from the workspace."},
	{Action: ActionCreate, Subject: SubjectsPackage, Name: "Create Package", Description: "Create new subscription plans."},
	{Action: ActionRead, Subject: SubjectsPackage, Name: "Read Package", Description: "View subscription plans and their quotas."},
	{Action: ActionUpdate, Subject: SubjectsPackage, Name: "Update Package", Description: "Edit subscription plan settings and quotas."},
	{Action: ActionDelete, Subject: SubjectsPackage, Name: "Delete Package", Description: "Delete subscription plans."},
	{Action: ActionCreate, Subject: SubjectsRole, Name: "Create Role", Description: "Create custom roles for team members."},
	{Action: ActionRead, Subject: SubjectsRole, Name: "Read Role", Description: "View roles and their permission sets."},
	{Action: ActionUpdate, Subject: SubjectsRole, Name: "Update Role", Description: "Edit roles and their permission sets."},
	{Action: ActionDelete, Subject: SubjectsRole, Name: "Delete Role", Description: "Delete custom roles."},
	{Action: ActionRead, Subject: SubjectsPermission, Name: "Read Permission", Description: "View the permission catalog."},
	{Action: ActionRead, Subject: SubjectsPaymentHistory, Name: "Read Payment History", Description: "View payment transaction records."},
	{Action: ActionRead, Subject: SubjectsUserPlanSnapshot, Name: "Read Plan Snapshot", Description: "View user plan quota and usage."},
	{Action: ActionCreate, Subject: SubjectsSubscription, Name: "Create Subscription", Description: "Subscribe to or upgrade a subscription plan."},
}

func isTenantPermission(p PermissionDefinition) bool {
	return !(p.Action == ActionManage && p.Subject == SubjectsAll)
}

type PackageQuota struct {
	Action  Action
	Subject Subjects
	Limit   int32
}

var FreePackageQuotas = []PackageQuota{
	{Action: ActionCreate, Subject: SubjectsBoard, Limit: 2},
	{Action: ActionCreate, Subject: SubjectsSmartWidget, Limit: 25},
	{Action: ActionCreate, Subject: SubjectsRole, Limit: 3},
}

var ProPackageQuotas = []PackageQuota{
	{Action: ActionCreate, Subject: SubjectsBoard, Limit: 10},
	{Action: ActionCreate, Subject: SubjectsSmartWidget, Limit: 100},
	{Action: ActionCreate, Subject: SubjectsRole, Limit: 10},
}

func assertQuotaSubsetOfTenant() error {
	tenantKeys := make(map[string]bool)
	for _, p := range PermissionCatalog {
		if isTenantPermission(p) {
			tenantKeys[PermissionKey(string(p.Action), string(p.Subject))] = true
		}
	}

	allQuotas := append(FreePackageQuotas, ProPackageQuotas...)
	for _, q := range allQuotas {
		key := PermissionKey(string(q.Action), string(q.Subject))
		if !tenantKeys[key] {
			return fmt.Errorf("quota references non-tenant permission: %s", key)
		}
	}
	return nil
}

// Seed executes the database seeding pipeline against a pgxpool connection pool.
func Seed(ctx context.Context, pool *pgxpool.Pool) error {
	if err := assertQuotaSubsetOfTenant(); err != nil {
		return fmt.Errorf("quota assertion failed: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	queries := repo.New(tx)

	log.Println("Seeding database...")

	// 0. Truncate tables
	log.Println("  Clearing tables...")
	if err := queries.TruncateAllTables(ctx); err != nil {
		return fmt.Errorf("failed to truncate tables: %w", err)
	}

	// 1. Seed permissions
	log.Println("  Seeding permissions...")
	permissionIDs := make(map[string]pgtype.UUID)

	for _, perm := range PermissionCatalog {
		p, err := queries.InsertPermission(ctx, repo.InsertPermissionParams{
			Action:      string(perm.Action),
			Subject:     string(perm.Subject),
			Name:        perm.Name,
			Description: pgtype.Text{String: perm.Description, Valid: true},
		})
		if err != nil {
			return fmt.Errorf("failed to insert permission %s:%s: %w", perm.Action, perm.Subject, err)
		}
		permissionIDs[PermissionKey(p.Action, p.Subject)] = p.ID
	}

	// 2. Seed Super Admin Role
	log.Println("  Seeding roles...")
	superAdminRoleID, err := queries.InsertRole(ctx, repo.InsertRoleParams{
		Title: "Super Admin",
		Slug:  auth.SuperAdminRoleSlug,
	})
	if err != nil {
		return fmt.Errorf("failed to insert super admin role: %w", err)
	}

	// 3. Seed Super Admin User
	log.Println("  Seeding users...")
	hash, err := bcrypt.GenerateFromPassword([]byte("qwerty1234%"), 10)
	if err != nil {
		return fmt.Errorf("failed hashing password: %w", err)
	}

	superAdminUserID, err := queries.InsertUser(ctx, repo.InsertUserParams{
		Name:     "Super Admin",
		Email:    "admin@collabgrid.com",
		Password: pgtype.Text{String: string(hash), Valid: true},
		Provider: pgtype.Text{String: "local", Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed inserting super admin user: %w", err)
	}

	if err := queries.AssignUserRole(ctx, repo.AssignUserRoleParams{
		UserID: superAdminUserID,
		RoleID: superAdminRoleID,
	}); err != nil {
		return fmt.Errorf("failed assigning super admin role: %w", err)
	}

	// 4. Seed Tenant Role
	tenantRoleID, err := queries.InsertRole(ctx, repo.InsertRoleParams{
		Title:           "Tenant",
		Slug:            auth.TenantRoleSlug,
		PrimaryUserID:   superAdminUserID,
		SecondaryUserID: superAdminUserID,
	})
	if err != nil {
		return fmt.Errorf("failed inserting tenant role: %w", err)
	}

	// 5. Seed Packages
	log.Println("  Seeding packages...")
	freePackageID, err := queries.InsertPackage(ctx, repo.InsertPackageParams{
		Title:           "Free",
		Slug:            auth.FreePackageSlug,
		Price:           "0",
		PrimaryUserID:   superAdminUserID,
		SecondaryUserID: superAdminUserID,
	})
	if err != nil {
		return fmt.Errorf("failed inserting free package: %w", err)
	}

	proPackageID, err := queries.InsertPackage(ctx, repo.InsertPackageParams{
		Title:           "Pro",
		Slug:            auth.ProPackageSlug,
		Price:           "9",
		PrimaryUserID:   superAdminUserID,
		SecondaryUserID: superAdminUserID,
	})
	if err != nil {
		return fmt.Errorf("failed inserting pro package: %w", err)
	}

	// 6. Seed Role Permissions
	log.Println("  Seeding role permissions...")

	superAdminPermID := permissionIDs[PermissionKey(string(ActionManage), string(SubjectsAll))]
	if err := queries.GrantRolePermission(ctx, repo.GrantRolePermissionParams{
		RoleID:       superAdminRoleID,
		PermissionID: superAdminPermID,
	}); err != nil {
		return fmt.Errorf("failed granting super admin permission: %w", err)
	}

	for _, perm := range PermissionCatalog {
		if isTenantPermission(perm) {
			pID := permissionIDs[PermissionKey(string(perm.Action), string(perm.Subject))]
			if err := queries.GrantRolePermission(ctx, repo.GrantRolePermissionParams{
				RoleID:       tenantRoleID,
				PermissionID: pID,
			}); err != nil {
				return fmt.Errorf("failed granting tenant permission: %w", err)
			}
		}
	}

	// 7. Seed Package Permission Limits
	log.Println("  Seeding package limits...")
	for _, quota := range FreePackageQuotas {
		pID := permissionIDs[PermissionKey(string(quota.Action), string(quota.Subject))]
		if err := queries.InsertPackagePermissionLimit(ctx, repo.InsertPackagePermissionLimitParams{
			PackageID:    freePackageID,
			PermissionID: pID,
			LimitCount:   pgtype.Int4{Int32: quota.Limit, Valid: true},
		}); err != nil {
			return fmt.Errorf("failed inserting free package limit: %w", err)
		}
	}

	for _, quota := range ProPackageQuotas {
		pID := permissionIDs[PermissionKey(string(quota.Action), string(quota.Subject))]
		if err := queries.InsertPackagePermissionLimit(ctx, repo.InsertPackagePermissionLimitParams{
			PackageID:    proPackageID,
			PermissionID: pID,
			LimitCount:   pgtype.Int4{Int32: quota.Limit, Valid: true},
		}); err != nil {
			return fmt.Errorf("failed inserting pro package limit: %w", err)
		}
	}

	// 8. Seed Tenant User
	log.Println("  Seeding tenant user...")
	tenantUserID, err := queries.InsertUser(ctx, repo.InsertUserParams{
		Name:     "Tenant User",
		Email:    "tenant@collabgrid.com",
		Password: pgtype.Text{String: string(hash), Valid: true},
		Provider: pgtype.Text{String: "local", Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed inserting tenant user: %w", err)
	}

	if err := queries.AssignUserRole(ctx, repo.AssignUserRoleParams{
		UserID: tenantUserID,
		RoleID: tenantRoleID,
	}); err != nil {
		return fmt.Errorf("failed assigning tenant role: %w", err)
	}

	// 9. Seed Subscription
	var numericAmount pgtype.Numeric
	numericAmount.Scan("0")

	if err := queries.InsertSubscription(ctx, repo.InsertSubscriptionParams{
		UserID:        tenantUserID,
		PackageID:     freePackageID,
		StartDate:     pgtype.Timestamp{Time: time.Now(), Valid: true},
		EndDate:       pgtype.Timestamp{Valid: false},
		PaymentMethod: "manual",
		Amount:        numericAmount,
	}); err != nil {
		return fmt.Errorf("failed inserting subscription: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed committing transaction: %w", err)
	}

	log.Println("Seed complete!")
	return nil
}
