package order

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

type PermissiveGateway struct{}

func NewPermissiveGateway() *PermissiveGateway {
	return &PermissiveGateway{}
}

func (g *PermissiveGateway) UserHoldsLock(ctx context.Context, boardID pgtype.UUID, widgetID pgtype.UUID, buyerUserID string) bool {
	return true
}

func (g *PermissiveGateway) CompletePurchase(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID, buyerUserID string) error {
	return nil
}
