package mock

import (
	"context"

	"github.com/asifulhaque087/loot-board/services/api/internal/service/auth"
)

type MemUoW struct {
	stores auth.Stores
}

func NewMemUoW(stores auth.Stores) *MemUoW {
	return &MemUoW{
		stores: stores,
	}
}

func (m *MemUoW) RunInTx(
	_ context.Context, fn func(auth.Stores) error) error {
	return fn(m.stores)
}
