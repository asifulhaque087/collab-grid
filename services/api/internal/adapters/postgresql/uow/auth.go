package uow

import (
	"context"

	"github.com/asifulhaque087/loot-board/services/api/internal/adapters/postgresql/repo"
	"github.com/asifulhaque087/loot-board/services/api/internal/core/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UoW struct {
	pool *pgxpool.Pool
}

func NewAuthUoW(pool *pgxpool.Pool) *UoW {
	return &UoW{pool: pool}
}

func (u *UoW) RunInTx(
	ctx context.Context,
	fn func(auth.Stores) error,
) error {
	tx, err := u.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	stores := auth.Stores{
		Auth: repo.NewAuthRepository(tx),
	}

	if err := fn(stores); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
