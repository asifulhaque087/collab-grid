package mail

import (
	"context"
	"fmt"

	"github.com/asifulhaque087/collab-grid/services/api/internal/mail/templates"
	"github.com/a-h/templ"
)

const defaultResetPasswordSubject = "Reset Your Password"

// MailService is the low-level interface for sending templ-rendered email.
type MailService interface {
	Send(ctx context.Context, to string, subject string, component templ.Component) error
}

// Provider satisfies auth.AuthMailService.
// Each method knows its own template and default subject.
type Provider struct {
	mailer *Mailer
}

func NewProvider(mailer *Mailer) *Provider {
	return &Provider{mailer: mailer}
}

func (p *Provider) Send(ctx context.Context, to string, subject string, component templ.Component) error {
	return p.mailer.Send(ctx, to, subject, component)
}

func (p *Provider) SendPasswordResetEmail(to string, name string, resetURL string, expirationMinutes int, subject ...string) error {
	subj := defaultResetPasswordSubject
	if len(subject) > 0 && subject[0] != "" {
		subj = subject[0]
	}

	component := templates.ResetPasswordEmail(name, resetURL, expirationMinutes)

	err := p.mailer.Send(context.Background(), to, subj, component)
	if err != nil {
		return fmt.Errorf("SendPasswordResetEmail: %w", err)
	}
	return nil
}
