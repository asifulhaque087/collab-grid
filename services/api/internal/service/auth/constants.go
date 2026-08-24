package auth

const (
	FreePackageSlug = "free"
	ProPackageSlug  = "pro"
)

const (
	TenantRoleSlug     = "tenant"
	SuperAdminRoleSlug = "super-admin"
)

const (
	ResetTokenBytes            = 32
	ForgotPasswordSuccessMsg   = "If an account with that email exists, a reset link has been sent."
	ResetPasswordSuccessMsg    = "Your password has been reset. You can now log in."
	LogoutSuccessMsg           = "Signed out successfully."
)

// // Package Slugs
// type Package string

// const (
// 	FreePackageSlug Package = "free"
// 	ProPackageSlug  Package = "pro"
// )

// // Tenant/Role Slugs
// type Role string

// const (
// 	TenantRoleSlug     Role = "tenant"
// 	SuperAdminRoleSlug Role = "super-admin"
// )
