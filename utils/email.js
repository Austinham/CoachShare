const nodemailer = require('nodemailer');

// Create function to send email
exports.sendEmail = async options => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "eb38f11d6525aa",
      pass: "48091e58e0a9a6"
    },
    debug: true, // Enable debug logging
    logger: true // Enable logger
  });

  // Log configuration in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Email Configuration:');
    console.log('Host: sandbox.smtp.mailtrap.io');
    console.log('Port: 2525');
    console.log('Username: eb38f11d6525aa');
    console.log('From:', process.env.EMAIL_FROM || 'noreply@coachshare.com');
  }

  // 2) Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@coachshare.com',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html // Add support for HTML emails
  };

  // 3) Actually send the email
  try {
    // Verify SMTP connection configuration
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', options.email);
    console.log('Message ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw new Error('Failed to send email');
  }
};

// Function to create an HTML email with verification link
exports.createVerificationEmail = (user, verificationUrl) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          padding: 20px;
          margin-top: 20px;
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
          margin-bottom: 20px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #4f46e5;
        }
        .button {
          display: inline-block;
          background-color: #4f46e5;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CoachShare</div>
        </div>
        
        <p>Hi ${user.firstName},</p>
        
        <p>Thanks for signing up! Please verify your email address to complete your registration.</p>
        
        <p style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </p>
        
        <p>If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
        
        <p style="word-break: break-all;">${verificationUrl}</p>
        
        <p>If you didn't create an account, please ignore this email.</p>
        
        <p>Best,<br>The CoachShare Team</p>
        
        <div class="footer">
          <p>CoachShare, Inc.</p>
          <p>This email was sent to ${user.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    html,
    text: `
      Hi ${user.firstName},
      
      Thanks for signing up! Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      If you didn't create an account, please ignore this email.
      
      Best,
      The CoachShare Team
    `
  };
};

// Function to create an HTML email with password reset link
exports.createPasswordResetEmail = (user, resetUrl) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          padding: 20px;
          margin-top: 20px;
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
          margin-bottom: 20px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #4f46e5;
        }
        .button {
          display: inline-block;
          background-color: #4f46e5;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .warning {
          color: #e53e3e;
          font-weight: bold;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CoachShare</div>
        </div>
        
        <p>Hi ${user.firstName},</p>
        
        <p>You recently requested to reset your password. Click the button below to reset it:</p>
        
        <p style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </p>
        
        <p>If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
        
        <p style="word-break: break-all;">${resetUrl}</p>
        
        <p class="warning">This link is valid for 10 minutes only.</p>
        
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        
        <p>Best,<br>The CoachShare Team</p>
        
        <div class="footer">
          <p>CoachShare, Inc.</p>
          <p>This email was sent to ${user.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    html,
    text: `
      Hi ${user.firstName},
      
      You recently requested to reset your password. Please click the link below to reset it:
      
      ${resetUrl}
      
      This link is valid for 10 minutes only.
      
      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
      
      Best,
      The CoachShare Team
    `
  };
}; 