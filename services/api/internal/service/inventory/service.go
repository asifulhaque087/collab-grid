package inventory

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"math"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

type Service struct {
	inventoryRepo InventoryRepo
	logger        *slog.Logger
}

func NewService(inventoryRepo InventoryRepo, logger *slog.Logger) *Service {
	return &Service{
		inventoryRepo: inventoryRepo,
		logger:        logger,
	}
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
		return pgtype.UUID{}, ErrInvalidItemID
	}
	return id, nil
}

func numericFromString(value string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if err := n.Scan(value); err != nil {
		return pgtype.Numeric{}, err
	}
	return n, nil
}

func numericToString(n pgtype.Numeric) *string {
	if !n.Valid {
		return nil
	}
	v, err := n.Value()
	if err != nil {
		return nil
	}
	str, ok := v.(string)
	if !ok {
		return nil
	}
	return &str
}

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	value := t.String
	return &value
}

func optionalBoardID(boardID *string) (pgtype.UUID, error) {
	if boardID == nil || *boardID == "" {
		return pgtype.UUID{}, nil
	}
	var id pgtype.UUID
	if err := id.Scan(*boardID); err != nil {
		return pgtype.UUID{}, ErrInvalidBoardID
	}
	return id, nil
}

func (s *Service) FindAll(ctx context.Context, userID string, parentID string, boardID *string) ([]InventoryResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	boardFilter, err := optionalBoardID(boardID)
	if err != nil {
		return nil, err
	}

	items, err := s.inventoryRepo.ListSmartWidgetsByPrimaryUserId(ctx, primaryUserID, boardFilter)
	if err != nil {
		s.logger.Error("failed to list inventory items", "primary_user_id", primaryUserID.String(), "error", err)
		return nil, ErrInternalServer
	}

	result := make([]InventoryResponseDto, 0, len(items))
	for _, item := range items {
		result = append(result, toItemResponseDto(item))
	}
	return result, nil
}

func (s *Service) Create(ctx context.Context, dto CreateInventoryRequestDto, userID string, parentID string) (*InventoryResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	var secondaryUserID pgtype.UUID
	if err := secondaryUserID.Scan(userID); err != nil {
		return nil, ErrUnauthorized
	}

	boardID, err := s.resolveOwnedBoardID(ctx, dto.BoardID, primaryUserID)
	if err != nil {
		return nil, err
	}

	width := int32(DefaultWidgetSize)
	if dto.Width != nil {
		width = *dto.Width
	}

	height := int32(DefaultWidgetSize)
	if dto.Height != nil {
		height = *dto.Height
	}

	price, err := optionalPrice(dto.Price)
	if err != nil {
		return nil, ErrInvalidPrice
	}

	item, err := s.inventoryRepo.CreateSmartWidget(ctx, CreateSmartWidgetParams{
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		BoardID:         boardID,
		Name:            dto.Name,
		Sku:             dto.Sku,
		Quantity:        dto.Quantity,
		Price:           price,
		Photo:           optionalText(dto.Photo),
		Width:           width,
		Height:          height,
	})
	if err != nil {
		s.logger.Error("failed to create inventory item", "name", dto.Name, "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, item.ID, primaryUserID)
}

func (s *Service) Update(ctx context.Context, id string, dto UpdateInventoryRequestDto, userID string, parentID string) (*InventoryResponseDto, error) {
	widgetID, err := parseUUID(id)
	if err != nil {
		return nil, err
	}

	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	if _, err := s.findByIdOrNotFound(ctx, widgetID, primaryUserID); err != nil {
		return nil, err
	}

	params := UpdateSmartWidgetParams{ID: widgetID}

	if dto.Name != nil {
		params.Name = pgtype.Text{String: *dto.Name, Valid: true}
	}
	if dto.Sku != nil {
		params.Sku = pgtype.Text{String: *dto.Sku, Valid: true}
	}
	if dto.Quantity != nil {
		params.Quantity = pgtype.Int4{Int32: *dto.Quantity, Valid: true}
	}
	if dto.Price != nil {
		price, err := optionalPrice(dto.Price)
		if err != nil {
			s.logger.Error("failed to parse price", "price", *dto.Price, "error", err)
			return nil, ErrInvalidPrice
		}
		params.Price = price
	}
	if dto.Photo != nil {
		params.Photo = pgtype.Text{String: *dto.Photo, Valid: true}
	}
	if dto.BoardID != nil {
		boardID, err := s.resolveOwnedBoardID(ctx, dto.BoardID, primaryUserID)
		if err != nil {
			return nil, err
		}
		params.BoardID = boardID
	}
	if dto.Width != nil {
		params.Width = pgtype.Int4{Int32: *dto.Width, Valid: true}
	}
	if dto.Height != nil {
		params.Height = pgtype.Int4{Int32: *dto.Height, Valid: true}
	}

	if err := s.inventoryRepo.UpdateSmartWidget(ctx, params); err != nil {
		s.logger.Error("failed to update inventory item", "id", id, "error", err)
		return nil, ErrInternalServer
	}

	return s.findByIdOrNotFound(ctx, widgetID, primaryUserID)
}

func (s *Service) Remove(ctx context.Context, id string, userID string, parentID string) error {
	widgetID, err := parseUUID(id)
	if err != nil {
		return err
	}

	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return err
	}

	if _, err := s.findByIdOrNotFound(ctx, widgetID, primaryUserID); err != nil {
		return err
	}

	if err := s.inventoryRepo.DeleteSmartWidget(ctx, widgetID); err != nil {
		s.logger.Error("failed to delete inventory item", "id", id, "error", err)
		return ErrInternalServer
	}

	return nil
}

func (s *Service) ImportCsv(ctx context.Context, content []byte, userID string, parentID string, boardID *string) (*ImportInventoryResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	var secondaryUserID pgtype.UUID
	if err := secondaryUserID.Scan(userID); err != nil {
		return nil, ErrUnauthorized
	}

	boardFilter, err := s.resolveOwnedBoardID(ctx, boardID, primaryUserID)
	if err != nil {
		return nil, err
	}

	rows := parseCsv(content)
	if len(rows) == 0 {
		return nil, ErrInvalidCsvFile
	}

	items := make([]CreateSmartWidgetParams, 0, len(rows))
	for _, row := range rows {
		price, err := optionalPrice(row.Price)
		if err != nil {
			s.logger.Error("failed to parse csv price", "price", row.Price, "error", err)
			return nil, ErrInternalServer
		}

		items = append(items, CreateSmartWidgetParams{
			PrimaryUserID:   primaryUserID,
			SecondaryUserID: secondaryUserID,
			BoardID:         boardFilter,
			Name:            row.Name,
			Sku:             row.Sku,
			Quantity:        row.Quantity,
			Price:           price,
			Photo:           optionalText(row.Photo),
			Width:           DefaultWidgetSize,
			Height:          DefaultWidgetSize,
		})
	}

	imported, err := s.inventoryRepo.CreateSmartWidgets(ctx, items)
	if err != nil {
		s.logger.Error("failed to import inventory items", "count", len(items), "error", err)
		return nil, ErrInternalServer
	}

	return &ImportInventoryResponseDto{Imported: imported}, nil
}

// assertBoardOwned mirrors the private helper of the same name in the TS service.
func (s *Service) assertBoardOwned(ctx context.Context, boardID pgtype.UUID, primaryUserID pgtype.UUID) error {
	exists, err := s.inventoryRepo.GetBoardExistsForUser(ctx, boardID, primaryUserID)
	if err != nil {
		s.logger.Error("failed to verify board ownership", "board_id", boardID.String(), "error", err)
		return ErrInternalServer
	}
	if !exists {
		return ErrBoardNotFound
	}
	return nil
}

func (s *Service) resolveOwnedBoardID(ctx context.Context, boardID *string, primaryUserID pgtype.UUID) (pgtype.UUID, error) {
	resolved, err := optionalBoardID(boardID)
	if err != nil {
		return pgtype.UUID{}, err
	}

	if resolved.Valid {
		if err := s.assertBoardOwned(ctx, resolved, primaryUserID); err != nil {
			return pgtype.UUID{}, err
		}
	}

	return resolved, nil
}

func (s *Service) findByIdOrNotFound(ctx context.Context, id pgtype.UUID, primaryUserID pgtype.UUID) (*InventoryResponseDto, error) {
	item, err := s.inventoryRepo.GetSmartWidgetById(ctx, GetSmartWidgetByIdParams{
		ID:            id,
		PrimaryUserID: primaryUserID,
	})
	if err != nil {
		if isNoRows(err) {
			return nil, ErrItemNotFound
		}
		s.logger.Error("failed to get inventory item by id", "id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	response := toItemResponseDto(item)
	return &response, nil
}

// parsedCsvRow mirrors ParsedCsvRow from the TS service.
type parsedCsvRow struct {
	Name     string
	Sku      string
	Price    *string
	Quantity int32
	Photo    *string
}

// parseCsv mirrors parseCsv from the TS service. Expected column order:
// name, sku, price, quantity, photo.
func parseCsv(content []byte) []parsedCsvRow {
	lines := strings.Split(string(content), "\n")

	trimmed := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			trimmed = append(trimmed, line)
		}
	}
	if len(trimmed) == 0 {
		return nil
	}

	first := strings.ToLower(trimmed[0])
	startIdx := 0
	if strings.Contains(first, "sku") || strings.Contains(first, "name") {
		startIdx = 1
	}

	rows := make([]parsedCsvRow, 0, len(trimmed))
	for _, line := range trimmed[startIdx:] {
		cells := strings.Split(line, ",")
		cellAt := func(i int) (string, bool) {
			if i < len(cells) {
				return strings.TrimSpace(cells[i]), true
			}
			return "", false
		}

		name, _ := cellAt(0)
		sku, _ := cellAt(1)
		if name == "" || sku == "" {
			continue
		}

		priceStr, hasPrice := cellAt(2)
		var price *string
		if hasPrice && priceStr != "" {
			if value, err := strconv.ParseFloat(priceStr, 64); err == nil && !math.IsNaN(value) {
				parsed := priceStr
				price = &parsed
			}
		}

		qtyStr, _ := cellAt(3)
		qty, err := strconv.ParseInt(qtyStr, 10, 32)
		if err != nil {
			qty = 0
		}

		var photo *string
		if photoStr, ok := cellAt(4); ok {
			photo = &photoStr
		}

		rows = append(rows, parsedCsvRow{
			Name:     name,
			Sku:      sku,
			Price:    price,
			Quantity: int32(qty),
			Photo:    photo,
		})
	}

	return rows
}

func optionalText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func optionalPrice(value *string) (pgtype.Numeric, error) {
	if value == nil || *value == "" {
		return pgtype.Numeric{}, nil
	}
	return numericFromString(*value)
}

// toItemResponseDto mirrors serialize from the TS service.
func toItemResponseDto(item SmartWidget) InventoryResponseDto {
	response := InventoryResponseDto{
		ID:        item.ID.String(),
		Sku:       item.Sku,
		Name:      item.Name,
		Quantity:  item.Quantity,
		Price:     numericToString(item.Price),
		Photo:     textToStringPtr(item.Photo),
		PosX:      numericToString(item.PosX),
		PosY:      numericToString(item.PosY),
		Width:     item.Width,
		Height:    item.Height,
		CreatedAt: item.CreatedAt.Time,
	}

	if item.BoardID.Valid {
		boardID := item.BoardID.String()
		response.BoardID = &boardID
	}
	if item.BoardName.Valid {
		boardName := item.BoardName.String
		response.BoardName = &boardName
	}

	return response
}
