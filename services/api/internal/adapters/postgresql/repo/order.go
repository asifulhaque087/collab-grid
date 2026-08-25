package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlc "github.com/asifulhaque087/collab-grid/services/api/internal/adapters/postgresql/sqlc"
	"github.com/asifulhaque087/collab-grid/services/api/internal/service/order"
)

type OrderRepository struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewOrderRepository(pool *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

func (r *OrderRepository) GetOrderIdByIdempotencyKey(ctx context.Context, idempotencyKey string) (pgtype.UUID, error) {
	return r.queries.GetOrderIdByIdempotencyKey(ctx, idempotencyKey)
}

func (r *OrderRepository) GetBoardIdById(ctx context.Context, id pgtype.UUID) (pgtype.UUID, error) {
	return r.queries.GetBoardIdById(ctx, id)
}

func (r *OrderRepository) ListWidgetsForOrder(ctx context.Context, boardID pgtype.UUID, widgetIDs []pgtype.UUID) ([]order.WidgetLine, error) {
	if len(widgetIDs) == 0 {
		return nil, nil
	}

	rows, err := r.queries.ListWidgetsForOrder(ctx, sqlc.ListWidgetsForOrderParams{
		BoardID:   boardID,
		WidgetIds: widgetIDs,
	})
	if err != nil {
		return nil, err
	}
	res := make([]order.WidgetLine, len(rows))
	for i, row := range rows {
		res[i] = order.WidgetLine{
			ID:       row.ID,
			Name:     row.Name,
			Sku:      row.Sku,
			Price:    numericToString(row.Price),
			Quantity: row.Quantity,
		}
	}
	return res, nil
}

func (r *OrderRepository) CreateOrder(ctx context.Context, arg order.CreateOrderParams, items []order.CreateOrderItem) (order.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return order.Order{}, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	var amountTotal pgtype.Numeric
	if err := amountTotal.Scan(arg.AmountTotal); err != nil {
		return order.Order{}, err
	}

	created, err := q.CreateOrder(ctx, sqlc.CreateOrderParams{
		IdempotencyKey: arg.IdempotencyKey,
		BoardID:        arg.BoardID,
		BuyerUserID:    arg.BuyerUserID,
		BuyerName:      arg.BuyerName,
		Email:          arg.Email,
		Phone:          arg.Phone,
		Address:        arg.Address,
		City:           arg.City,
		PostalCode:     arg.PostalCode,
		Country:        arg.Country,
		AmountTotal:    amountTotal,
		PaymentMethod:  arg.PaymentMethod,
		CardLast4:      arg.CardLast4,
		Status:         arg.Status,
	})
	if err != nil {
		return order.Order{}, err
	}

	if len(items) > 0 {
		rows := make([]sqlc.CreateOrderItemsParams, len(items))
		for i, item := range items {
			var price pgtype.Numeric
			if err := price.Scan(item.Price); err != nil {
				return order.Order{}, err
			}
			rows[i] = sqlc.CreateOrderItemsParams{
				OrderID:  created.ID,
				WidgetID: item.WidgetID,
				Name:     item.Name,
				Sku:      item.Sku,
				Price:    price,
				Quantity: item.Quantity,
			}
		}
		if _, err := q.CreateOrderItems(ctx, rows); err != nil {
			return order.Order{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return order.Order{}, err
	}

	return toDomainOrder(created), nil
}

func (r *OrderRepository) ListOrdersWithItemsByPrimaryUserID(ctx context.Context, primaryUserID pgtype.UUID) ([]order.OrderWithItems, error) {
	rows, err := r.queries.ListOrdersByPrimaryUserID(ctx, primaryUserID)
	if err != nil {
		return nil, err
	}

	grouped := make(map[pgtype.UUID]*order.OrderWithItems)
	ids := make([]pgtype.UUID, 0, len(rows))

	for _, row := range rows {
		g, ok := grouped[row.ID]
		if !ok {
			g = &order.OrderWithItems{
				Order: order.Order{
					ID:            row.ID,
					BoardID:       row.BoardID,
					BuyerName:     row.BuyerName,
					Email:         row.Email,
					AmountTotal:   numericToString(row.AmountTotal),
					PaymentMethod: row.PaymentMethod,
					CardLast4:     row.CardLast4,
					Status:        row.Status,
					CreatedAt:     row.CreatedAt.Time,
				},
				BoardName: row.BoardName,
				Items:     make([]order.OrderItem, 0),
			}
			grouped[row.ID] = g
			ids = append(ids, row.ID)
		}
		g.Items = append(g.Items, order.OrderItem{
			ID:       row.ItemID,
			Name:     row.ItemName,
			Sku:      row.ItemSku,
			Price:    numericToString(row.ItemPrice),
			Quantity: row.ItemQuantity,
		})
	}

	res := make([]order.OrderWithItems, 0, len(ids))
	for _, id := range ids {
		res = append(res, *grouped[id])
	}
	return res, nil
}

func (r *OrderRepository) GetOrderById(ctx context.Context, id pgtype.UUID) (order.OrderWithItems, error) {
	row, err := r.queries.GetOrderById(ctx, id)
	if err != nil {
		return order.OrderWithItems{}, err
	}

	itemRows, err := r.queries.ListOrderItemsByOrderId(ctx, id)
	if err != nil {
		return order.OrderWithItems{}, err
	}

	items := make([]order.OrderItem, len(itemRows))
	for i, itemRow := range itemRows {
		items[i] = order.OrderItem{
			ID:       itemRow.ID,
			Name:     itemRow.Name,
			Sku:      itemRow.Sku,
			Price:    numericToString(itemRow.Price),
			Quantity: itemRow.Quantity,
		}
	}

	return order.OrderWithItems{
		Order: toDomainOrder(row),
		Items: items,
	}, nil
}

func toDomainOrder(row sqlc.Order) order.Order {
	return order.Order{
		ID:            row.ID,
		BoardID:       row.BoardID,
		BuyerUserID:   row.BuyerUserID,
		BuyerName:     row.BuyerName,
		Email:         row.Email,
		Phone:         row.Phone,
		Address:       row.Address,
		City:          row.City,
		PostalCode:    row.PostalCode,
		Country:       row.Country,
		AmountTotal:   numericToString(row.AmountTotal),
		PaymentMethod: row.PaymentMethod,
		CardLast4:     row.CardLast4,
		Status:        row.Status,
		CreatedAt:     row.CreatedAt.Time,
	}
}

func numericToString(n pgtype.Numeric) string {
	v, err := n.Value()
	if err != nil {
		return "0"
	}
	s, ok := v.(string)
	if !ok {
		return "0"
	}
	return s
}
