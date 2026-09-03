package auth

import "context"

type contextKey string

const UserContextKey contextKey = "user_claims"

func GetUserFromContext(ctx context.Context) (*JwtPayload, bool) {
	user, ok := ctx.Value(UserContextKey).(*JwtPayload)
	return user, ok
}
