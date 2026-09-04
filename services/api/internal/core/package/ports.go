package pkg

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// Repo is consumed by the Service.
type Repo interface {
	ListTenantRolePermissions(ctx context.Context, slug string) ([]Permission, error)
	ListPackages(ctx context.Context) ([]Package, error)
	GetPackageByID(ctx context.Context, id pgtype.UUID) (Package, error)
	ListPackagePermissionLimits(ctx context.Context, packageIDs []pgtype.UUID) ([]PackagePermission, error)
	CreatePackage(ctx context.Context, arg CreatePackageParams, permissions []PackagePermissionInput) (Package, error)
	UpdatePackage(ctx context.Context, arg UpdatePackageParams) error
	DeletePackage(ctx context.Context, id pgtype.UUID) error
}

// PackageService is consumed by the Handler.
type PackageService interface {
	ListPermissions(ctx context.Context) ([]PermissionResponseDto, error)
	FindAll(ctx context.Context) ([]PackageResponseDto, error)
	FindPublicPackages(ctx context.Context) ([]PublicPackageDto, error)
	Create(ctx context.Context, dto CreatePackageRequestDto, userID string) (*PackageResponseDto, error)
	Update(ctx context.Context, id string, dto UpdatePackageRequestDto) (*PackageResponseDto, error)
	Remove(ctx context.Context, id string) error
}
