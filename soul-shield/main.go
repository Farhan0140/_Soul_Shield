// @title Soul Shield
// @version 1.0
// @description Your Daily Steps Towards Jannah
// @termsOfService http://swagger.io/terms/

// @contact.name Farhan
// @contact.email farhannadim0000@gmail.com

// @license.name MIT

// @host localhost:3000
// @BasePath /
// @schemes http

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
package main

import "soulsheld/cmd"
import _ "soulsheld/docs"

func main() {
	cmd.Serve()
}