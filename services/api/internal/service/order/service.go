package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/asifulhaque087/collab-grid/services/api/internal/mail/templates"
)

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

func resolvePrimaryUserID(userID string, parentID string) (pgtype.UUID, error) {
	id := userID
	if parentID != "" {
		id = parentID
	}

	var uid pgtype.UUID
	if err := uid.Scan(id); err != nil {
		return pgtype.UUID{}, ErrInternalServer
	}
	return uid, nil
}

func parseID(value string, invalidErr error) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, invalidErr
	}
	return id, nil
}

func numericToFloat(n pgtype.Numeric) float64 {
	v, err := n.Value()
	if err != nil {
		return 0
	}
	s, ok := v.(string)
	if !ok {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}

func numericToFloatStr(value string) float64 {
	f, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	return f
}

func taka(value string) string {
	f := numericToFloatStr(value)
	formatted := strconv.FormatFloat(f, 'f', 2, 64)

	intPart := formatted
	frac := ""
	if idx := len(formatted) - 3; idx > 0 && formatted[idx] == '.' {
		intPart = formatted[:idx]
		frac = formatted[idx:]
	}

	neg := false
	if len(intPart) > 0 && intPart[0] == '-' {
		neg = true
		intPart = intPart[1:]
	}

	var sb []byte
	for i, c := range []byte(intPart) {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			sb = append(sb, ',')
		}
		sb = append(sb, c)
	}

	out := string(sb) + frac
	if neg {
		out = "-" + out
	}
	return fmt.Sprintf("Tk %s", out)
}

func formatInvoiceDate(t time.Time) string {
	return t.Format("January 2, 2006")
}

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	value := t.String
	return &value
}

func uuidToStringPtr(id pgtype.UUID) *string {
	if !id.Valid {
		return nil
	}
	value := id.String()
	return &value
}

func textFromPtr(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

type Service struct {
	orderRepo OrderRepo
	gateway   RealtimeGateway
	mailer    InvoiceMailer
	logger    *slog.Logger
}

func NewService(orderRepo OrderRepo, gateway RealtimeGateway, mailer InvoiceMailer, logger *slog.Logger) *Service {
	return &Service{
		orderRepo: orderRepo,
		gateway:   gateway,
		mailer:    mailer,
		logger:    logger,
	}
}

func (s *Service) Create(ctx context.Context, dto CreateOrderRequestDto) (*CreateOrderResponseDto, error) {
	existingID, err := s.orderRepo.GetOrderIdByIdempotencyKey(ctx, dto.IdempotencyKey)
	if err == nil {
		return &CreateOrderResponseDto{OrderID: existingID.String(), Duplicate: true}, nil
	}
	if !isNoRows(err) {
		s.logger.Error("failed to check idempotency key", "error", err)
		return nil, ErrInternalServer
	}

	boardUUID, err := parseID(dto.BoardID, ErrInvalidBoardID)
	if err != nil {
		return nil, err
	}

	boardID, err := s.orderRepo.GetBoardIdById(ctx, boardUUID)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to get board", "board_id", dto.BoardID, "error", err)
		return nil, ErrInternalServer
	}

	widgetIDs := make([]pgtype.UUID, 0, len(dto.WidgetIds))
	for _, raw := range dto.WidgetIds {
		widgetID, err := parseID(raw, ErrInvalidWidgetID)
		if err != nil {
			return nil, err
		}
		widgetIDs = append(widgetIDs, widgetID)
	}

	widgets, err := s.orderRepo.ListWidgetsForOrder(ctx, boardUUID, widgetIDs)
	if err != nil {
		s.logger.Error("failed to list widgets for order", "error", err)
		return nil, ErrInternalServer
	}
	if len(widgets) != len(dto.WidgetIds) {
		return nil, ErrItemsUnavailable
	}

	buyerUserID := ""
	if dto.BuyerUserId != nil {
		buyerUserID = *dto.BuyerUserId
	}

	for _, widget := range widgets {
		if !s.gateway.UserHoldsLock(ctx, boardUUID, widget.ID, buyerUserID) {
			return nil, ErrReservationExpired
		}
	}

	total := 0.0
	for _, widget := range widgets {
		total += numericToFloatStr(widget.Price)
	}

	items := make([]CreateOrderItem, 0, len(widgets))
	for _, widget := range widgets {
		items = append(items, CreateOrderItem{
			WidgetID: widget.ID,
			Name:     widget.Name,
			Sku:      widget.Sku,
			Price:    widget.Price,
			Quantity: widget.Quantity,
		})
	}

	created, err := s.orderRepo.CreateOrder(ctx, CreateOrderParams{
		IdempotencyKey: dto.IdempotencyKey,
		BoardID:        boardID,
		BuyerUserID:    textFromPtr(dto.BuyerUserId),
		BuyerName:      textFromPtr(dto.BuyerName),
		Email:          textFromPtr(dto.Email),
		Phone:          textFromPtr(dto.Phone),
		Address:        dto.Address,
		City:           textFromPtr(dto.City),
		PostalCode:     textFromPtr(dto.PostalCode),
		Country:        textFromPtr(dto.Country),
		AmountTotal:    strconv.FormatFloat(total, 'f', 2, 64),
		PaymentMethod:  "card",
		CardLast4:      textFromPtr(dto.CardLast4),
		Status:         "paid",
	}, items)
	if err != nil {
		dupID, dupErr := s.orderRepo.GetOrderIdByIdempotencyKey(ctx, dto.IdempotencyKey)
		if dupErr == nil {
			return &CreateOrderResponseDto{OrderID: dupID.String(), Duplicate: true}, nil
		}
		s.logger.Error("failed to create order", "idempotency_key", dto.IdempotencyKey, "error", err)
		return nil, ErrInternalServer
	}

	if err := s.gateway.CompletePurchase(ctx, boardUUID, widgetIDs, buyerUserID); err != nil {
		s.logger.Error("failed to complete purchase", "order_id", created.ID.String(), "error", err)
	}

	if dto.Email != nil && *dto.Email != "" {
		view := buildInvoiceView(OrderWithItems{Order: created})
		if err := s.mailer.SendOrderInvoiceEmail(*dto.Email, view.Order, view.Items); err != nil {
			s.logger.Error("failed to send invoice email", "order_id", created.ID.String(), "error", err)
		}
	}

	return &CreateOrderResponseDto{OrderID: created.ID.String(), Duplicate: false}, nil
}

func (s *Service) FindAll(ctx context.Context, userID string, parentID string) ([]OrderResponseDto, error) {
	scopeUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	orders, err := s.orderRepo.ListOrdersWithItemsByPrimaryUserID(ctx, scopeUserID)
	if err != nil {
		s.logger.Error("failed to list orders", "primary_user_id", scopeUserID.String(), "error", err)
		return nil, ErrInternalServer
	}

	result := make([]OrderResponseDto, 0, len(orders))
	for _, o := range orders {
		result = append(result, toOrderResponseDto(o))
	}
	return result, nil
}

func (s *Service) Invoice(ctx context.Context, id string) (*InvoiceView, error) {
	orderID, err := parseID(id, ErrInvalidOrderID)
	if err != nil {
		return nil, err
	}

	o, err := s.orderRepo.GetOrderById(ctx, orderID)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrOrderNotFound
		}
		s.logger.Error("failed to get order", "id", id, "error", err)
		return nil, ErrInternalServer
	}

	view := buildInvoiceView(o)
	return &view, nil
}

func buildInvoiceView(o OrderWithItems) InvoiceView {
	orderView := templates.InvoiceOrder{
		ID:            o.ID.String(),
		CreatedAt:     formatInvoiceDate(o.CreatedAt),
		Status:        o.Status,
		BuyerName:     derefText(o.BuyerName),
		Email:         derefText(o.Email),
		Phone:         derefText(o.Phone),
		Address:       o.Address,
		City:          derefText(o.City),
		PostalCode:    derefText(o.PostalCode),
		Country:       derefText(o.Country),
		PaymentMethod: o.PaymentMethod,
		CardLast4:     derefText(o.CardLast4),
		Total:         taka(o.AmountTotal),
	}

	itemViews := make([]templates.InvoiceItem, 0, len(o.Items))
	for _, item := range o.Items {
		lineTotal := numericToFloatStr(item.Price) * float64(item.Quantity)
		itemViews = append(itemViews, templates.InvoiceItem{
			Name:      item.Name,
			Sku:       item.Sku,
			Price:     taka(item.Price),
			Quantity:  item.Quantity,
			LineTotal: taka(strconv.FormatFloat(lineTotal, 'f', 2, 64)),
		})
	}

	return InvoiceView{Order: orderView, Items: itemViews}
}

func derefText(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

func toOrderResponseDto(o OrderWithItems) OrderResponseDto {
	items := make([]OrderItemDto, 0, len(o.Items))
	for _, item := range o.Items {
		items = append(items, OrderItemDto{
			ID:       item.ID.String(),
			Name:     item.Name,
			Sku:      item.Sku,
			Price:    item.Price,
			Quantity: item.Quantity,
		})
	}

	return OrderResponseDto{
		ID:            o.ID.String(),
		BuyerName:     textToStringPtr(o.BuyerName),
		Email:         textToStringPtr(o.Email),
		AmountTotal:   o.AmountTotal,
		PaymentMethod: o.PaymentMethod,
		CardLast4:     textToStringPtr(o.CardLast4),
		Status:        o.Status,
		CreatedAt:     o.CreatedAt,
		BoardID:       uuidToStringPtr(o.BoardID),
		BoardName:     &o.BoardName,
		Items:         items,
	}
}
