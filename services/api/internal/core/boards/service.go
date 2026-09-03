package boards

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows)
}

const (
	defaultMaxSize     = 10000
	uniqueSlugAttempts = 5
	randomSuffixLength = 4
	slugCharset        = "0123456789abcdefghijklmnopqrstuvwxyz"
	fallbackSlug       = "board"
)

var (
	slugSpaces      = regexp.MustCompile(`\s+`)
	slugInvalidChar = regexp.MustCompile(`[^a-z0-9-]`)
)

type Service struct {
	boardRepo BoardRepo
	logger    *slog.Logger
}

func NewService(boardRepo BoardRepo, logger *slog.Logger) *Service {
	return &Service{
		boardRepo: boardRepo,
		logger:    logger,
	}
}

func toSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.TrimSpace(slug)
	slug = slugSpaces.ReplaceAllString(slug, "-")
	return slugInvalidChar.ReplaceAllString(slug, "")
}

func randomSuffix(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	for i := range b {
		b[i] = slugCharset[b[i]%byte(len(slugCharset))]
	}
	return string(b)
}

func (s *Service) uniqueSlug(ctx context.Context, name string) (string, error) {
	base := toSlug(name)
	if base == "" {
		base = fallbackSlug
	}

	slug := base

	for range uniqueSlugAttempts {
		_, err := s.boardRepo.GetBoardIdBySlug(ctx, slug)
		if err == nil {
			slug = base + "-" + randomSuffix(randomSuffixLength)
			continue
		}
		if isNoRows(err) {
			return slug, nil
		}
		s.logger.Error("failed to check slug availability", "slug", slug, "error", err)
		return "", ErrInternalServer
	}

	return base + "-" + strconv.FormatInt(time.Now().UnixMilli(), 36), nil
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
		return pgtype.UUID{}, ErrInvalidBoardID
	}
	return id, nil
}

func (s *Service) FindAll(ctx context.Context, userID string, parentID string) ([]BoardResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	list, err := s.boardRepo.ListBoardsByPrimaryUserId(ctx, primaryUserID)
	if err != nil {
		s.logger.Error("failed to list boards", "primary_user_id", primaryUserID.String(), "error", err)
		return nil, ErrInternalServer
	}

	result := make([]BoardResponseDto, 0, len(list))
	for _, b := range list {
		result = append(result, toBoardResponseDto(b))
	}
	return result, nil
}

func (s *Service) Create(ctx context.Context, dto CreateBoardRequestDto, userID string, parentID string) (*BoardResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	var secondaryUserID pgtype.UUID
	if err := secondaryUserID.Scan(userID); err != nil {
		return nil, ErrUnauthorized
	}

	slug, err := s.uniqueSlug(ctx, dto.Name)
	if err != nil {
		return nil, err
	}

	maxWidth := pgtype.Int4{Int32: defaultMaxSize, Valid: true}
	if dto.MaxWidth != nil {
		maxWidth = pgtype.Int4{Int32: *dto.MaxWidth, Valid: true}
	}

	maxHeight := pgtype.Int4{Int32: defaultMaxSize, Valid: true}
	if dto.MaxHeight != nil {
		maxHeight = pgtype.Int4{Int32: *dto.MaxHeight, Valid: true}
	}

	board, err := s.boardRepo.CreateBoard(ctx, CreateBoardParams{
		PrimaryUserID:   primaryUserID,
		SecondaryUserID: secondaryUserID,
		Name:            dto.Name,
		Slug:            slug,
		Access:          dto.Access,
		MaxWidth:        maxWidth,
		MaxHeight:       maxHeight,
	})
	if err != nil {
		s.logger.Error("failed to create board", "name", dto.Name, "error", err)
		return nil, ErrInternalServer
	}

	return s.getBoardByIdOrNotFound(ctx, board.ID, primaryUserID)
}

func (s *Service) Update(ctx context.Context, id string, dto UpdateBoardRequestDto, userID string, parentID string) (*BoardResponseDto, error) {
	boardID, err := parseUUID(id)
	if err != nil {
		return nil, err
	}

	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	if _, err := s.getBoardByIdOrNotFound(ctx, boardID, primaryUserID); err != nil {
		return nil, err
	}

	params := UpdateBoardParams{ID: boardID}

	if dto.Name != nil {
		params.Name = pgtype.Text{String: *dto.Name, Valid: true}
	}
	if dto.Access != nil {
		params.Access = pgtype.Text{String: *dto.Access, Valid: true}
	}
	if dto.MaxWidth != nil {
		params.MaxWidth = pgtype.Int4{Int32: *dto.MaxWidth, Valid: true}
	}
	if dto.MaxHeight != nil {
		params.MaxHeight = pgtype.Int4{Int32: *dto.MaxHeight, Valid: true}
	}

	if _, err := s.boardRepo.UpdateBoard(ctx, params); err != nil {
		s.logger.Error("failed to update board", "board_id", id, "error", err)
		return nil, ErrInternalServer
	}

	return s.getBoardByIdOrNotFound(ctx, boardID, primaryUserID)
}

func (s *Service) Remove(ctx context.Context, id string, userID string, parentID string) error {
	boardID, err := parseUUID(id)
	if err != nil {
		return err
	}

	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return err
	}

	if _, err := s.getBoardByIdOrNotFound(ctx, boardID, primaryUserID); err != nil {
		return err
	}

	if err := s.boardRepo.DeleteBoard(ctx, boardID); err != nil {
		s.logger.Error("failed to delete board", "board_id", id, "error", err)
		return ErrInternalServer
	}

	return nil
}

func (s *Service) FindBySlug(ctx context.Context, slug string, userID string, parentID string) (*BoardResponseDto, error) {
	primaryUserID, err := resolvePrimaryUserID(userID, parentID)
	if err != nil {
		return nil, err
	}

	board, err := s.boardRepo.GetBoardBySlug(ctx, GetBoardBySlugParams{
		Slug:          slug,
		PrimaryUserID: primaryUserID,
	})
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to get board by slug", "slug", slug, "error", err)
		return nil, ErrInternalServer
	}

	response := toBoardResponseDto(board)
	return &response, nil
}

func (s *Service) FindPublicBySlug(ctx context.Context, slug string) (*BoardResponseDto, error) {
	board, err := s.boardRepo.GetPublicBoardBySlug(ctx, slug)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to get public board by slug", "slug", slug, "error", err)
		return nil, ErrInternalServer
	}

	response := toBoardResponseDto(board)
	return &response, nil
}

func (s *Service) getBoardByIdOrNotFound(ctx context.Context, id pgtype.UUID, primaryUserID pgtype.UUID) (*BoardResponseDto, error) {
	board, err := s.boardRepo.GetBoardById(ctx, GetBoardByIdParams{
		ID:            id,
		PrimaryUserID: primaryUserID,
	})
	if err != nil {
		if isNoRows(err) {
			return nil, ErrBoardNotFound
		}
		s.logger.Error("failed to get board by id", "board_id", id.String(), "error", err)
		return nil, ErrInternalServer
	}

	response := toBoardResponseDto(board)
	return &response, nil
}

func toBoardResponseDto(board Board) BoardResponseDto {
	response := BoardResponseDto{
		ID:          board.ID.String(),
		Slug:        board.Slug,
		Name:        board.Name,
		Access:      board.Access,
		WidgetCount: board.WidgetCount,
		CreatedAt:   board.CreatedAt.Time,
	}

	if board.MaxWidth.Valid {
		maxWidth := board.MaxWidth.Int32
		response.MaxWidth = &maxWidth
	}
	if board.MaxHeight.Valid {
		maxHeight := board.MaxHeight.Int32
		response.MaxHeight = &maxHeight
	}

	return response
}
