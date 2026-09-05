package templates

import (
	"fmt"
	"strings"
)

func statusLabel(status string) string {
	if status == "" {
		return ""
	}
	return strings.ToUpper(status[:1]) + status[1:]
}

func statusBgColor(status string) string {
	if status == "paid" {
		return "#ecfdf5"
	}
	return "#fffbeb"
}

func statusTextColor(status string) string {
	if status == "paid" {
		return "#059669"
	}
	return "#d97706"
}

func regionLine(city, postalCode, country string) string {
	parts := make([]string, 0, 3)
	for _, p := range []string{city, postalCode, country} {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return strings.Join(parts, ", ")
}

func paymentLine(paymentMethod, cardLast4 string) string {
	line := strings.ToUpper(paymentMethod[:1]) + paymentMethod[1:] + " card"
	if cardLast4 != "" {
		line += fmt.Sprintf(" ending in %s", cardLast4)
	}
	return line
}

func bgColorForIndex(i int) string {
	if i%2 == 0 {
		return "background-color: #fafafa;"
	}
	return ""
}
