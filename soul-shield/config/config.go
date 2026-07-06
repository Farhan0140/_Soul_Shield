package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/lpernett/godotenv"
)

type DBConfig struct {
	Host          string
	Port          int
	DBName        string
	User          string
	Password      string
	EnableSSLMode bool
}

type SMTPConfig struct {
	Host     string
	Port     string
	Email    string
	Password string
}

type Config struct {
	Version       string
	ServiceName   string
	HttpPort      int
	SecretKey     string
	DB            *DBConfig
	SMTP          *SMTPConfig
	NeonDBconnStr string
}

var configuration *Config

func loadConfig() {
	if os.Getenv("ENV") != "production" {
		err := godotenv.Load()
		if err != nil {
			fmt.Println("No .env file found, using system environment variables")
		}
	}

	// Loads all .env variables one by one
	version := os.Getenv("VERSION")
	if version == "" {
		fmt.Println("Version is Required")
		os.Exit(1)
	}

	serviceName := os.Getenv("SERVICENAME")
	if serviceName == "" {
		fmt.Println("Service Name is Required")
		os.Exit(1)
	}

	httpPortStr := os.Getenv("HTTPPORT")
	if httpPortStr == "" {
		fmt.Println("HTTP Port is Required")
		os.Exit(1)
	}
	httpPort, err := strconv.Atoi(httpPortStr)
	if err != nil {
		fmt.Println("Failed to convert the httpPort String to Int", err)
		os.Exit(1)
	}

	secretKey := os.Getenv("SECRETKEY")
	if secretKey == "" {
		fmt.Println("Secret Key is Required")
		os.Exit(1)
	}

	// Loads all Data-Base .env variables one by one
	db_host := os.Getenv("DB_HOST")
	if db_host == "" {
		fmt.Println("Database Host is Required")
		os.Exit(1)
	}

	db_portStr := os.Getenv("DB_PORT")
	db_port, err := strconv.Atoi(db_portStr)
	if err != nil {
		fmt.Println("Failed to convert the httpPort String to Int", err)
		os.Exit(1)
	}

	db_name := os.Getenv("DB_NAME")
	if db_name == "" {
		fmt.Println("Database Name is Required")
		os.Exit(1)
	}

	db_user := os.Getenv("DB_USER")
	if db_user == "" {
		fmt.Println("Database User is Required")
		os.Exit(1)
	}

	db_password := os.Getenv("DB_PASSWORD")
	if db_password == "" {
		fmt.Println("Database Password is Required")
		os.Exit(1)
	}

	db_enable_ssl_mode_bool := os.Getenv("DB_ENABLE_SSL_MODE")
	db_enable_ssl_mode, err := strconv.ParseBool(db_enable_ssl_mode_bool)
	if err != nil {
		fmt.Println("Failed to convert the SSL Mode String to Bool", err)
		os.Exit(1)
	}

	db_config := &DBConfig{
		Host:          db_host,
		Port:          db_port,
		DBName:        db_name,
		User:          db_user,
		Password:      db_password,
		EnableSSLMode: db_enable_ssl_mode,
	}

	var smtp_config = &SMTPConfig{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     os.Getenv("SMTP_PORT"),
		Email:    os.Getenv("SMTP_EMAIL"),
		Password: os.Getenv("SMTP_PASSWORD"),
	}

	// Online Neon Database
	connStr := os.Getenv("CONN_STRING_FOR_DB")

	configuration = &Config{
		Version:     version,
		ServiceName: serviceName,
		HttpPort:    httpPort,
		SecretKey:   secretKey,
		DB:          db_config,
		SMTP:        smtp_config,

		NeonDBconnStr: connStr,
	}
}

func GetConfig() *Config {
	if configuration == nil {
		loadConfig()
	}

	return configuration
}
