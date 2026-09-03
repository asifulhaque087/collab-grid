package pkg

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

var (
	slugSpaces      = regexp.MustCompile(`\s+`)
	slugInvalidChar = regexp.MustCompile(`[^a-z0-9-]`)
)

func toSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.TrimSpace(slug)
	slug = slugSpaces.ReplaceAllString(slug, "-")
	return slugInvalidChar.ReplaceAllString(slug, "")
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInvalidPackageID
	}
	return id, nil
}

func parsePermissionID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInvalidPermission
	}
	return id, nil
}

func uuidToStringPtr(id pgtype.UUID) *string {
	if !id.Valid {
		return nil
	}
	value := id.String()
	return &value
}

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	value := t.String
	return &value
}

const UnlimitedQuota = -1

var quotaFeatureText = map[string]string{
	"Board":       "boards",
	"SmartWidget": "products",
	"Role":        "custom roles",
}

// Ordered so the public pricing table lists features in a stable order.
var quotaFeatureOrder = []string{"Board", "SmartWidget", "Package", "Role"}

type Service struct {
	repo   Repo
	logger *slog.Logger
}

func NewService(repo Repo, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) ListPermissions(ctx context.Context) ([]PermissionResponseDto, error) {
	perms, err := s.repo.ListTenantRolePermissions(ctx, auth.TenantRoleSlug)
	if err != nil {
		s.logger.Error("failed to list tenant permissions", "error", err)
		return nil, ErrInternalServer
	}

	result := make([]PermissionResponseDto, 0, len(perms))
	for _, p := range perms {
		result = append(result, toPermissionResponseDto(p))
	}
	return result, nil
}

func (s *Service) FindAll(ctx context.Context) ([]PackageResponseDto, error) {
	return s.findAll(ctx)
}

func (s *Service) FindPublicPackages(ctx context.Context) ([]PublicPackageDto, error) {
	packages, err := s.repo.ListPackages(ctx)
	if err != nil {
		s.logger.Error("failed to list packages", "error", err)
		return nil, ErrInternalServer
	}

	packageIDs := make([]pgtype.UUID, 0, len(packages))
	for _, p := range packages {
		packageIDs = append(packageIDs, p.ID)
	}

	limits, err := s.repo.ListPackagePermissionLimits(ctx, packageIDs)
	if err != nil {
		s.logger.Error("failed to list package permission limits", "error", err)
		return nil, ErrInternalServer
	}

	limitsByPackage := make(map[pgtype.UUID][]PackagePermission)
	for _, l := range limits {
		limitsByPackage[l.PackageID] = append(limitsByPackage[l.PackageID], l)
	}

	result := make([]PublicPackageDto, 0, len(packages))
	for _, p := range packages {
		monthlyPrice, _ := strconv.Atoi(p.Price)

		features := make([]PublicPackageFeatureDto, 0)
		for _, l := range limitsByPackage[p.ID] {
			text, ok := quotaFeatureText[l.Subject]
			if !ok || l.Limit == nil {
				continue
			}
			value := "Unlimited"
			if *l.Limit != UnlimitedQuota {
				value = strconv.Itoa(int(*l.Limit))
			}
			features = append(features, PublicPackageFeatureDto{Value: value, Text: text})
		}

		sort.SliceStable(features, func(i, j int) bool {
			return indexOf(quotaFeatureOrder, features[i].Text) < indexOf(quotaFeatureOrder, features[j].Text)
		})

		result = append(result, PublicPackageDto{
			ID:           p.ID.String(),
			Slug:         p.Slug,
			Title:        p.Title,
			Price:        p.Price,
			MonthlyPrice: monthlyPrice,
			Featured:     monthlyPrice > 0,
			Features:     features,
		})
	}

	sort.SliceStable(result, func(i, j int) bool {
		return result[i].MonthlyPrice < result[j].MonthlyPrice
	})
	return result, nil
}

func (s *Service) Create(ctx context.Context, dto CreatePackageRequestDto, userID string) (*PackageResponseDto, error) {
	primaryUserID, err := parseUUID(userID)
	if err != nil {
		return nil, err
	}

	permissions := make([]PackagePermissionInput, 0, len(dto.Permissions))
	for _, p := range dto.Permissions {
		permID, err := parsePermissionID(p.PermissionID)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, PackagePermissionInput{
			PermissionID: permID,
			Limit:        p.Limit,
		})
	}

	created, err := s.repo.CreatePackage(ctx, CreatePackageParams{
		Slug:            toSlug(dto.Name),
		Title:           dto.Name,
		Price:           dto.Price,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: pgtype.UUID{},
	}, permissions)
	if err != nil {
		s.logger.Error("failed to create package", "name", dto.Name, "error", err)
		return nil, ErrInternalServer
	}

	return s.findById(ctx, created.ID)
}

func (s *Service) Update(ctx context.Context, id string, dto UpdatePackageRequestDto) (*PackageResponseDto, error) {
	packageID, err := parseUUID(id)
	if err != nil {
		return nil, err
	}

	existing, err := s.findById(ctx, packageID)
	if err != nil {
		return nil, err
	}

	params := UpdatePackageParams{ID: packageID}

	if dto.Name != nil {
		if existing.IsSystem {
			params.Title = dto.Name
		} else {
			slug := toSlug(*dto.Name)
			params.Slug = &slug
			params.Title = dto.Name
		}
	}

	if dto.Price != nil {
		params.Price = dto.Price
	}

	if dto.Permissions != nil {
		inputs := make([]PackagePermissionInput, 0, len(*dto.Permissions))
		for _, p := range *dto.Permissions {
			permID, err := parsePermissionID(p.PermissionID)
			if err != nil {
				return nil, err
			}
			inputs = append(inputs, PackagePermissionInput{
				PermissionID: permID,
				Limit:        p.Limit,
			})
		}
		params.Permissions = &inputs
	}

	if err := s.repo.UpdatePackage(ctx, params); err != nil {
		s.logger.Error("failed to update package", "id", id, "error", err)
		return nil, ErrInternalServer
	}

	return s.findById(ctx, packageID)
}

func (s *Service) Remove(ctx context.Context, id string) error {
	packageID, err := parseUUID(id)
	if err != nil {
		return err
	}

	existing, err := s.findById(ctx, packageID)
	if err != nil {
		return err
	}

	if existing.IsSystem {
		return ErrSystemPackage
	}

	if err := s.repo.DeletePackage(ctx, packageID); err != nil {
		s.logger.Error("failed to delete package", "id", id, "error", err)
		return ErrInternalServer
	}

	return nil
}

func (s *Service) findAll(ctx context.Context) ([]PackageResponseDto, error) {
	packages, err := s.repo.ListPackages(ctx)
	if err != nil {
		s.logger.Error("failed to list packages", "error", err)
		return nil, ErrInternalServer
	}

	packageIDs := make([]pgtype.UUID, 0, len(packages))
	for _, p := range packages {
		packageIDs = append(packageIDs, p.ID)
	}

	limits, err := s.repo.ListPackagePermissionLimits(ctx, packageIDs)
	if err != nil {
		s.logger.Error("failed to list package permission limits", "error", err)
		return nil, ErrInternalServer
	}

	limitsByPackage := make(map[pgtype.UUID][]PackagePermission)
	for _, l := range limits {
		limitsByPackage[l.PackageID] = append(limitsByPackage[l.PackageID], l)
	}

	result := make([]PackageResponseDto, 0, len(packages))
	for _, p := range packages {
		result = append(result, toPackageResponseDto(p, limitsByPackage[p.ID]))
	}
	return result, nil
}

func (s *Service) findById(ctx context.Context, id pgtype.UUID) (*PackageResponseDto, error) {
	pkgRow, err := s.repo.GetPackageByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrPackageNotFound
		}
		s.logger.Error("failed to get package by id", "id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	limits, err := s.repo.ListPackagePermissionLimits(ctx, []pgtype.UUID{id})
	if err != nil {
		s.logger.Error("failed to list package permission limits", "id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	response := toPackageResponseDto(pkgRow, limits)
	return &response, nil
}

func toPermissionResponseDto(p Permission) PermissionResponseDto {
	return PermissionResponseDto{
		ID:          p.ID.String(),
		Name:        p.Name,
		Action:      p.Action,
		Subject:     p.Subject,
		Description: textToStringPtr(p.Description),
	}
}

func toPackageResponseDto(p Package, limits []PackagePermission) PackageResponseDto {
	permissions := make([]PackagePermissionResponseDto, 0, len(limits))
	for _, l := range limits {
		permissions = append(permissions, toPackagePermissionResponseDto(l))
	}

	return PackageResponseDto{
		ID:              p.ID.String(),
		Slug:            p.Slug,
		Title:           p.Title,
		Price:           p.Price,
		PrimaryUserID:   uuidToStringPtr(p.PrimaryUserID),
		SecondaryUserID: uuidToStringPtr(p.SecondaryUserID),
		IsSystem:        !p.PrimaryUserID.Valid,
		SubscriberCount: p.SubscriberCount,
		Permissions:     permissions,
	}
}

func toPackagePermissionResponseDto(l PackagePermission) PackagePermissionResponseDto {
	return PackagePermissionResponseDto{
		ID:      l.PermissionID.String(),
		Name:    l.Name,
		Action:  l.Action,
		Subject: l.Subject,
		Limit:   l.Limit,
	}
}

func indexOf(haystack []string, needle string) int {
	for i, v := range haystack {
		if v == needle {
			return i
		}
	}
	return len(haystack)
}
