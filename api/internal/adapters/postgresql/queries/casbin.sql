
-- name: TruncateCasbinRules :exec
TRUNCATE TABLE casbin_rule RESTART IDENTITY;

-- name: InsertCasbinPolicy :exec
INSERT INTO casbin_rule (ptype, v0, v1, v2)
VALUES ($1, $2, $3, $4);

-- name: InsertCasbinGrouping :exec
INSERT INTO casbin_rule (ptype, v0, v1)
VALUES ($1, $2, $3);
