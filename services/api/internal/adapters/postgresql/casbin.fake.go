package postgresql

import (
	"fmt"

	// "github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/casbin/casbin/v2"
	// "github.com/asifulhaque087/collab-grid/api/internal/config"
	// "github.com/casbin/casbin/v2"
)

type PolicyRule struct {
	Sub string
	Obj string
	Act string
}

type RoleMapping struct {
	User string
	Role string
}

func InitFakeCasbinEnforcer() (*casbin.Enforcer, error) {
	m, err := config.GetCasbinModel()
	if err != nil {
		return nil, fmt.Errorf("failed to load casbin model: %w", err)
	}

	// Pass the model directly without an adapter
	enforcer, err := casbin.NewEnforcer(m)
	if err != nil {
		return nil, fmt.Errorf("failed to create fake casbin enforcer: %w", err)
	}

	// 1. Define policies using structs / slices
	policies := []PolicyRule{
		{Sub: "admin", Obj: "/users", Act: "POST"},
		{Sub: "user", Obj: "/users", Act: "GET"},
	}

	for _, p := range policies {
		if _, err := enforcer.AddPolicy(p.Sub, p.Obj, p.Act); err != nil {
			return nil, fmt.Errorf("failed to add policy: %w", err)
		}
	}

	// 2. Define role mappings using structs / slices
	roles := []RoleMapping{
		{User: "alice", Role: "admin"},
		{User: "bob", Role: "user"},
	}

	for _, r := range roles {
		if _, err := enforcer.AddGroupingPolicy(r.User, r.Role); err != nil {
			return nil, fmt.Errorf("failed to add grouping policy: %w", err)
		}
	}

	return enforcer, nil
}
