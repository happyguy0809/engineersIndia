// functions/index.js - Firebase Cloud Functions for Engineers India
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer').default || require('nodemailer');
const cors = require('cors')({origin: true});
const busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');

admin.initializeApp();

// Email configuration
let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: functions.config().email.user,
        pass: functions.config().email.pass
      }
    });
  }
  return transporter;
}

// WhatsApp notification numbers
const NOTIFICATION_NUMBERS = [
  '918800954628',  // Number 1 - update with your actual numbers
  '919150400011',  // Number 2 - update with your actual numbers  
  '919176982286'   // Number 3 - update with your actual numbers
];

// Function to send WhatsApp notifications
async function sendWhatsAppAlerts(alertType, companyName = '') {
  const notifications = [];
  
  const messages = {
    quote: `🔔 NEW QUOTE REQUEST\nFrom: ${companyName}\nCheck email: ei1995@gmail.com\nTime: ${new Date().toLocaleString('en-IN')}`,
    contact: `📞 NEW CONTACT MESSAGE\nFrom: ${companyName}\nCheck email: ei1995@gmail.com\nTime: ${new Date().toLocaleString('en-IN')}`
  };

  const message = messages[alertType] || `📧 New email received\nCheck: ei1995@gmail.com`;

  // Send to all 3 numbers via webhook
  for (const number of NOTIFICATION_NUMBERS) {
    try {
      // Using webhook (Zapier/Pabbly)
      const webhookUrl = functions.config().whatsapp?.webhook_url;
      if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: number,
            message: message,
            timestamp: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          notifications.push(`WhatsApp sent to ${number}`);
        }
      }
    } catch (error) {
      console.error(`WhatsApp error for ${number}:`, error);
    }
  }
  
  console.log('WhatsApp notifications:', notifications.join(', ') || 'None sent');
  return notifications.length > 0;
}

// Quote form submission
exports.submitQuote = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
      const bb = busboy({ headers: req.headers });
      const fields = {};
      const files = [];
      const tmpdir = os.tmpdir();

      // Parse form data and files
      bb.on('field', (fieldname, val) => {
        fields[fieldname] = val;
      });

      bb.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;
        const filepath = path.join(tmpdir, filename);
        const writeStream = fs.createWriteStream(filepath);
        
        file.pipe(writeStream);
        
        files.push({
          fieldname,
          originalname: filename,
          mimetype: mimeType,
          path: filepath
        });
      });

      bb.on('finish', async () => {
        try {
          const { company, contact_person, email, phone, component_type, quantity, material, timeline, description } = fields;

          // Validate required fields
          if (!company || !contact_person || !email || !component_type || !description) {
            return res.status(400).json({ 
              success: false, 
              message: 'Please fill in all required fields' 
            });
          }

          // Create detailed email
          const emailHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0A0E27; border-bottom: 3px solid #00D4FF; padding-bottom: 10px;">
                New Quote Request - Engineers India
              </h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0A0E27; margin-top: 0;">Company Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold; width: 30%;">Company:</td>
                    <td style="padding: 8px;">${company}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Contact Person:</td>
                    <td style="padding: 8px;">${contact_person}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Email:</td>
                    <td style="padding: 8px;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px;">${phone || 'Not provided'}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0A0E27; margin-top: 0;">Project Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold; width: 30%;">Component Type:</td>
                    <td style="padding: 8px;">${component_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Quantity:</td>
                    <td style="padding: 8px;">${quantity || 'Not specified'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Material:</td>
                    <td style="padding: 8px;">${material || 'Not specified'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Timeline:</td>
                    <td style="padding: 8px;">${timeline || 'Not specified'}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0A0E27; margin-top: 0;">Description</h3>
                <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #00D4FF;">
                  ${description}
                </p>
              </div>
              
              ${files.length > 0 ? `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #0A0E27; margin-top: 0;">Attached Files (${files.length})</h3>
                  <ul style="list-style-type: none; padding: 0;">
                    ${files.map(file => `
                      <li style="padding: 5px; background: white; margin: 5px 0; border-radius: 3px;">
                        📎 ${file.originalname}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
              
              <div style="background: #0A0E27; color: white; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0;">
                  <strong>Submitted:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">
                  Engineers India - Precision Machining Solutions
                </p>
              </div>
            </div>
          `;

          // Prepare attachments
          const attachments = files.map(file => ({
            filename: file.originalname,
            path: file.path
          }));

          // Send email
          await getTransporter().sendMail({
            from: functions.config().email.user,
            to: 'ei1995@gmail.com',
            subject: `Quote Request: ${company} - ${component_type}`,
            html: emailHTML,
            attachments: attachments
          });

          // Send WhatsApp notifications
          await sendWhatsAppAlerts('quote', company);

          // Clean up temporary files
          files.forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (err) {
              console.error('Error deleting temp file:', err);
            }
          });

          res.json({ 
            success: true, 
            message: 'Quote request submitted successfully! We will contact you within 24 hours.' 
          });

        } catch (error) {
          console.error('Quote submission error:', error);
          res.status(500).json({ 
            success: false, 
            message: 'Failed to submit quote request. Please try again or call +91 9150400011' 
          });
        }
      });

      bb.end(req.rawBody);

    } catch (error) {
      console.error('Quote processing error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Please try again.' 
      });
    }
  });
});

// Contact form submission
exports.submitContact = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
      const { name, company, email, phone, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please fill in all required fields' 
        });
      }

      // Create detailed email
      const emailHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0A0E27; border-bottom: 3px solid #00D4FF; padding-bottom: 10px;">
            New Contact Message - Engineers India
          </h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0A0E27; margin-top: 0;">Contact Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; background: #e9ecef; font-weight: bold; width: 30%;">Name:</td>
                <td style="padding: 8px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Company:</td>
                <td style="padding: 8px;">${company || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Email:</td>
                <td style="padding: 8px;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Phone:</td>
                <td style="padding: 8px;">${phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #e9ecef; font-weight: bold;">Subject:</td>
                <td style="padding: 8px;">${subject}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0A0E27; margin-top: 0;">Message</h3>
            <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #00D4FF;">
              ${message}
            </p>
          </div>
          
          <div style="background: #0A0E27; color: white; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0;">
              <strong>Submitted:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">
              Engineers India - Precision Machining Solutions
            </p>
          </div>
        </div>
      `;

      // Send email
      await getTransporter().sendMail({
        from: functions.config().email.user,
        to: 'ei1995@gmail.com',
        subject: `Contact: ${subject} - ${name}`,
        html: emailHTML
      });

      // Send WhatsApp notifications
      await sendWhatsAppAlerts('contact', company || name);

      res.json({ 
        success: true, 
        message: 'Message sent successfully! We will get back to you soon.' 
      });

    } catch (error) {
      console.error('Contact submission error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send message. Please try again or call +91 9150400011' 
      });
    }
  });
});

// Health check
exports.health = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'Engineers India Firebase Functions'
    });
  });
});