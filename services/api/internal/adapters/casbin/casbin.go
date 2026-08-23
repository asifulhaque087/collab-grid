package casbin

import (
	"fmt"
	"log"

	"github.com/asifulhaque087/collab-grid/services/api/internal/config"
	"github.com/casbin/casbin/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	pgxadapter "github.com/pckhoi/casbin-pgx-adapter/v3"
)

// CasbinEnforcer satisfies the domain authorization interface by wrapping *casbin.Enforcer.
type CasbinEnforcer struct {
	enforcer *casbin.Enforcer
}

func NewCasbinEnforcer(e *casbin.Enforcer) *CasbinEnforcer {
	return &CasbinEnforcer{enforcer: e}
}

func (c *CasbinEnforcer) Enforce(rvals ...interface{}) (bool, error) {
	return c.enforcer.Enforce(rvals...)
}

func (c *CasbinEnforcer) AddPolicy(params ...interface{}) (bool, error) {
	return c.enforcer.AddPolicy(params...)
}

func (c *CasbinEnforcer) AddGroupingPolicy(params ...interface{}) (bool, error) {
	return c.enforcer.AddGroupingPolicy(params...)
}

func (c *CasbinEnforcer) ClearPolicy() {
	c.enforcer.ClearPolicy()
}

func (c *CasbinEnforcer) SavePolicy() error {
	return c.enforcer.SavePolicy()
}

// InitCasbinEnforcer sets up the Casbin PG adapter and loads policies into memory.
func InitCasbinEnforcer(dbConnString string) (*CasbinEnforcer, error) {
	// 1. Get the embedded model from internal/config
	m, err := config.GetCasbinModel()
	if err != nil {
		return nil, fmt.Errorf("failed to load casbin model: %w", err)
	}

	// 2. Parse dbConnString to extract the database name dynamically
	pgxCfg, err := pgxpool.ParseConfig(dbConnString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database connection string: %w", err)
	}

	dbName := pgxCfg.ConnConfig.Database

	// 3. Pass the parsed database name into WithDatabase()
	adapter, err := pgxadapter.NewAdapter(dbConnString, pgxadapter.WithDatabase(dbName))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize casbin pg adapter: %w", err)
	}

	// 4. Create Enforcer with embedded model and DB adapter
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
	return NewCasbinEnforcer(enforcer), nil
}
