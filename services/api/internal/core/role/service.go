package role

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"regexp"
	"sort"
	"strings"

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

// resolvePrimaryUserID mirrors `parentId ?? userId` from the TS service.
func resolvePrimaryUserID(userID string, parentID string) (pgtype.UUID, error) {
	id := userID
	if parentID != "" {
		id = parentID
	}

	var uid pgtype.UUID
	if err := uid.Scan(id); err != nil {
		return pgtype.UUID{}, ErrUnauthorized
	}
	return uid, nil
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, ErrInvalidRoleID
	}
	return id, nil
}

func parsePermissionIDs(ids []string) ([]pgtype.UUID, error) {
	parsed := make([]pgtype.UUID, 0, len(ids))
	for _, raw := range ids {
		var id pgtype.UUID
		if err := id.Scan(raw); err != nil {
			return nil, ErrInvalidPermission
		}
		parsed = append(parsed, id)
	}
	return parsed, nil
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

type Service struct {
	roleRepo RoleRepo
	enforcer Enforcer
	logger   *slog.Logger
}

func NewService(roleRepo RoleRepo, enforcer Enforcer, logger *slog.Logger) *Service {
	return &Service{
		roleRepo: roleRepo,
		enforcer: enforcer,
		logger:   logger,
	}
}

func (s *Service) ListPermissions(ctx context.Context, userID string) ([]PermissionResponseDto, error) {
	userIDUUID, err := resolvePrimaryUserID(userID, "")
	if err != nil {
		return nil, err
	}

	userPermissions, err := s.roleRepo.GetUserPermissions(ctx, userIDUUID)
	if err != nil {
		s.logger.Error("failed to list user permissions", "user_id", userID, "error", err)
		return nil, ErrInternalServer
	}

	hasWildcard := false
	for _, p := range userPermissions {
		if p.Action == ActionManage && p.Subject == SubjectAll {
			hasWildcard = true
			break
		}
	}

	if hasWildcard {
		allPermissions, err := s.roleRepo.ListAllPermissions(ctx)
		if err != nil {
			s.logger.Error("failed to list all permissions", "error", err)
			return nil, ErrInternalServer
		}

		result := make([]PermissionResponseDto, 0, len(allPermissions))
		for _, p := range allPermissions {
			if p.Action == ActionManage && p.Subject == SubjectAll {
				continue
			}
			result = append(result, toPermissionResponseDto(p))
		}
		sortPermissions(result)
		return result, nil
	}

	result := make([]PermissionResponseDto, 0, len(userPermissions))
	for _, p := range userPermissions {
		result = append(result, toPermissionResponseDto(Permission{
			ID:          p.ID,
			Name:        p.Name,
			Action:      p.Action,
			Subject:     p.Subject,
			Description: p.Description,
		}))
	}
	sortPermissions(result)
	return result, nil
}

func (s *Service) FindAll(ctx context.Context, userID string, parentID string) ([]RoleResponseDto, error) {
	scopeUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	roles, err := s.roleRepo.ListRolesByPrimaryUserID(ctx, scopeUserID)
	if err != nil {
		s.logger.Error("failed to list roles", "primary_user_id", scopeUserID.String(), "error", err)
		return nil, ErrInternalServer
	}

	roleIDs := make([]pgtype.UUID, 0, len(roles))
	for _, r := range roles {
		roleIDs = append(roleIDs, r.ID)
	}

	grants, err := s.roleRepo.ListRolePermissionsByRoleIDs(ctx, roleIDs)
	if err != nil {
		s.logger.Error("failed to list role permissions", "error", err)
		return nil, ErrInternalServer
	}

	permissionsByRole := make(map[pgtype.UUID][]RolePermission)
	for _, g := range grants {
		permissionsByRole[g.RoleID] = append(permissionsByRole[g.RoleID], g)
	}

	result := make([]RoleResponseDto, 0, len(roles))
	for _, r := range roles {
		response := toRoleResponseDto(r, permissionsByRole[r.ID])
		// findAll mirrors the TS service and omits secondaryUserId.
		response.SecondaryUserID = nil
		result = append(result, response)
	}
	return result, nil
}

func (s *Service) Create(ctx context.Context, dto CreateRoleRequestDto, userID string, parentID string) (*RoleResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	var secondaryUserID pgtype.UUID
	if err := secondaryUserID.Scan(userID); err != nil {
		return nil, ErrUnauthorized
	}

	permissionIDs, err := parsePermissionIDs(dto.PermissionIDs)
	if err != nil {
		return nil, err
	}

	created, err := s.roleRepo.CreateRole(ctx, CreateRoleParams{
		Slug:            toSlug(dto.Name),
		Title:           dto.Name,
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
	}, permissionIDs)
	if err != nil {
		s.logger.Error("failed to create role", "name", dto.Name, "error", err)
		return nil, ErrInternalServer
	}

	if err := s.syncRolePolicies(ctx, created.ID); err != nil {
		s.logger.Error("failed to sync casbin policies for role", "role_id", created.ID.String(), "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, created.ID)
}

func (s *Service) Update(ctx context.Context, id string, dto UpdateRoleRequestDto) (*RoleResponseDto, error) {
	roleID, err := parseUUID(id)
	if err != nil {
		return nil, err
	}

	if _, err := s.findByIdOrNotFound(ctx, roleID); err != nil {
		return nil, err
	}

	params := UpdateRoleParams{ID: roleID, Title: dto.Name}

	if dto.PermissionIDs != nil {
		permissionIDs, err := parsePermissionIDs(*dto.PermissionIDs)
		if err != nil {
			return nil, err
		}
		params.PermissionIDs = permissionIDs
	}

	if err := s.roleRepo.UpdateRole(ctx, params); err != nil {
		s.logger.Error("failed to update role", "id", id, "error", err)
		return nil, ErrInternalServer
	}

	if err := s.syncRolePolicies(ctx, roleID); err != nil {
		s.logger.Error("failed to sync casbin policies for role", "role_id", id, "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, roleID)
}

func (s *Service) Remove(ctx context.Context, id string) error {
	roleID, err := parseUUID(id)
	if err != nil {
		return err
	}

	if err := s.roleRepo.DeleteRole(ctx, roleID); err != nil {
		s.logger.Error("failed to delete role", "id", id, "error", err)
		return ErrInternalServer
	}

	if _, err := s.enforcer.RemoveFilteredPolicy(0, roleID.String()); err != nil {
		s.logger.Error("failed to remove casbin policies for role", "role_id", id, "error", err)
		return ErrInternalServer
	}

	if _, err := s.enforcer.RemoveFilteredGroupingPolicy(1, roleID.String()); err != nil {
		s.logger.Error("failed to remove casbin groupings for role", "role_id", id, "error", err)
		return ErrInternalServer
	}

	return nil
}

// syncRolePolicies mirrors the role's DB permissions into Casbin policy rules
// of the form p(role_id, endpoint, method).
func (s *Service) syncRolePolicies(ctx context.Context, roleID pgtype.UUID) error {
	endpoints, err := s.roleRepo.ListRolePermissionEndpoints(ctx, roleID)
	if err != nil {
		return err
	}

	roleStr := roleID.String()
	if _, err := s.enforcer.RemoveFilteredPolicy(0, roleStr); err != nil {
		return err
	}

	for _, ep := range endpoints {
		if _, err := s.enforcer.AddPolicy(roleStr, ep.Endpoint, ep.Method); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) findByIdOrNotFound(ctx context.Context, id pgtype.UUID) (*RoleResponseDto, error) {
	roleRow, err := s.roleRepo.GetRoleById(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrRoleNotFound
		}
		s.logger.Error("failed to get role by id", "id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	grants, err := s.roleRepo.ListRolePermissionsByRoleIDs(ctx, []pgtype.UUID{id})
	if err != nil {
		s.logger.Error("failed to list role permissions", "role_id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	response := toRoleResponseDto(roleRow, grants)
	return &response, nil
}

func sortPermissions(permissions []PermissionResponseDto) {
	sort.SliceStable(permissions, func(i, j int) bool {
		if permissions[i].Subject != permissions[j].Subject {
			return permissions[i].Subject < permissions[j].Subject
		}
		return permissions[i].Action < permissions[j].Action
	})
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

func toRoleResponseDto(r Role, grants []RolePermission) RoleResponseDto {
	permissions := make([]PermissionResponseDto, 0, len(grants))
	for _, g := range grants {
		permissions = append(permissions, PermissionResponseDto{
			ID:      g.PermissionID.String(),
			Name:    g.Name,
			Action:  g.Action,
			Subject: g.Subject,
		})
	}

	return RoleResponseDto{
		ID:              r.ID.String(),
		Slug:            r.Slug,
		Title:           r.Title,
		PrimaryUserID:   uuidToStringPtr(r.PrimaryUserID),
		SecondaryUserID: uuidToStringPtr(r.SecondaryUserID),
		MemberCount:     r.MemberCount,
		Permissions:     permissions,
	}
}
