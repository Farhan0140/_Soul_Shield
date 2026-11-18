package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/lpernett/godotenv"
)

// DefaultCorsOrigins are the browser origins allowed to call the API when
// CORS_ORIGINS is not set: the production web app and Vite's dev/preview ports.
const DefaultCorsOrigins = "https://soul-shield.vercel.app,http://localhost:5173,http://localhost:4173"

type Config struct {
	Version     string
	ServiceName string
	// HttpPort is the local-dev fallback; hosts like Render set PORT instead.
	HttpPort      int
	SecretKey     string
	NeonDBconnStr string
	// CorsOrigins are the exact browser origins allowed by CORS ("*" allows all).
	CorsOrigins []string
}

var configuration *Config

// fail prints a configuration error and stops: the server can't run without it.
func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "config: "+format+"\n", args...)
	os.Exit(1)
}

func loadConfig() {
	if os.Getenv("ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			fmt.Println("No .env file found, using system environment variables")
		}
	}

	// Only what the server actually uses is required. (The old DB_HOST/DB_PORT/
	// DB_NAME/DB_USER/DB_PASSWORD/DB_ENABLE_SSL_MODE and SMTP_* variables were
	// required or read but never used; they are ignored now if still set.)
	secretKey := os.Getenv("SECRETKEY")
	if secretKey == "" {
		fail("SECRETKEY is required")
	}

	connStr := os.Getenv("CONN_STRING_FOR_DB")
	if connStr == "" {
		fail("CONN_STRING_FOR_DB is required (the Postgres connection URL)")
	}

	httpPort := 3000
	if v := os.Getenv("HTTPPORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil || port <= 0 || port > 65535 {
			fail("HTTPPORT must be a port number, got %q", v)
		}
		httpPort = port
	}

	configuration = &Config{
		Version:       os.Getenv("VERSION"),
		ServiceName:   os.Getenv("SERVICENAME"),
		HttpPort:      httpPort,
		SecretKey:     secretKey,
		NeonDBconnStr: connStr,
		CorsOrigins:   ParseOrigins(os.Getenv("CORS_ORIGINS")),
	}
}

// ParseOrigins splits a comma-separated CORS_ORIGINS value (trailing slashes
// removed); an empty value means DefaultCorsOrigins.
func ParseOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		raw = DefaultCorsOrigins
	}
	var origins []string
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

func GetConfig() *Config {
	if configuration == nil {
		loadConfig()
	}

	return configuration
}
