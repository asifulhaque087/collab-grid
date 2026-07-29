// internal/adapters/postgresql/casbin.go
package postgresql

import (
	"fmt"
	"log"

	"github.com/asifulhaque087/collab-grid/api/internal/config"
	"github.com/casbin/casbin/v2"

	// pgxadapter "github.com/noho-digital/casbin-pgx-adapter"
	pgxadapter "github.com/pckhoi/casbin-pgx-adapter/v3"
)

// InitCasbinEnforcer sets up the Casbin PG adapter and loads policies into memory.
func InitCasbinEnforcer(dbConnString string) (*casbin.Enforcer, error) {
	// 1. Get the embedded model from internal/config
	m, err := config.GetCasbinModel()
	if err != nil {
		return nil, fmt.Errorf("failed to load casbin model: %w", err)
	}

	// 2. Initialize PostgreSQL adapter; creates 'casbin_rule' table automatically if it doesn't exist
	// adapter, err := pgxadapter.NewAdapter(dbConnString, pgxadapter.WithDatabase(""))
	adapter, err := pgxadapter.NewAdapter(dbConnString, pgxadapter.WithDatabase("demo"))
	// adapter, err := pgxadapter.NewAdapter(dbConnString, pgxadapter.WithMigrate(false))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize casbin pg adapter: %w", err)
	}

	// 3. Create Enforcer with embedded model and DB adapter
	enforcer, err := casbin.NewEnforcer(m, adapter)
	if err != nil {
		return nil, fmt.Errorf("failed to create casbin enforcer: %w", err)
	}

	if err := enforcer.LoadPolicy(); err != nil {
		return nil, fmt.Errorf("failed to load policies from database: %w", err)
	}

	// AutoSave writes dynamic policy changes (e.AddPolicy, e.AddGroupingPolicy) straight to PostgreSQL
	enforcer.EnableAutoSave(true)

	log.Println("Casbin Enforcer initialized successfully with PG Adapter")
	return enforcer, nil
}
