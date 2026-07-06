package util

import (
	"soulsheld/config"
	"strconv"

	"gopkg.in/gomail.v2"
)

func SendOTPEmail(email string, otp string) error {

	m := gomail.NewMessage()

	m.SetHeader("From", config.GetConfig().SMTP.Email)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "SoulShield Email Verification")

	// HTML + CSS formatted body
    htmlBody := `
		<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
			
			<div style="background-color: #4F46E5; padding: 25px 20px; text-align: center;">
				<h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">SoulShield Email Verification</h2>
			</div>
			
			<div style="padding: 40px 20px; text-align: center; background-color: #fffff6;">
				<p style="color: #4b5563; font-size: 16px; margin-bottom: 25px;">Your One-Time Password (OTP) for verification is:</p>
				
				<div style="display: inline-block; background-color: #f3f4f6; color: #1f2937; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 14px 30px; border-radius: 6px; border: 1px dashed #4F46E5; margin-bottom: 25px;">
					` + otp + `
				</div>
				
				<p style="color: #ef4444; font-size: 14px; font-weight: 500; margin: 0; padding: 8px 12px; background-color: #fef2f2; display: inline-box; border-radius: 4px;">
					⏱️ This OTP expires in 5 minutes
				</p>
			</div>
			
			<div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
				<p style="color: #9ca3af; font-size: 12px; margin: 0;">If you didn't request this, you can safely ignore this email.</p>
			</div>
		</div>
    `

    m.SetBody("text/html", htmlBody)

	port_s := config.GetConfig().SMTP.Port
	port_int, err := strconv.Atoi(port_s)

	if err != nil {
		return err
	}

	d := gomail.NewDialer(
		config.GetConfig().SMTP.Host,
		port_int,
		config.GetConfig().SMTP.Email,
		config.GetConfig().SMTP.Password,
	)

	return d.DialAndSend(m)
}
