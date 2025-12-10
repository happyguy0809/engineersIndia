// FIRST LINE - Load environment variables
require('dotenv').config();

// functions/index.js - Firebase Cloud Functions for Engineers India v2
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createTransport } = require('nodemailer');
const cors = require('cors')({ origin: true, credentials: true });
const path = require('path');
const os = require('os');
const fs = require('fs');

admin.initializeApp();

// Email configuration
let transporter;

function getTransporter() {
  if (!transporter) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
      throw new Error('Email configuration missing');
    }
    
    transporter = createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass }
    });
  }
  return transporter;
}

// WhatsApp notifications
const NOTIFICATION_NUMBERS = ['918800954628', '919150400011', '919176982286'];

async function sendWhatsAppAlerts(alertType, companyName = '') {
  const messages = {
    quote: `🔔 NEW QUOTE REQUEST\nFrom: ${companyName}\nCheck: happyguy0809@gmail.com`,
    contact: `📞 NEW CONTACT\nFrom: ${companyName}\nCheck: happyguy0809@gmail.com`
  };

  try {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    if (webhookUrl) {
      for (const number of NOTIFICATION_NUMBERS) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: number, message: messages[alertType] })
          });
        } catch (error) {
          console.error(`WhatsApp error for ${number}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.log('WhatsApp skipped:', error.message);
  }
}

// Contact form submission
exports.submitContact = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    console.log('=== Contact Request ===');

    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
      const { name, company, email, phone, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email' });
      }

      const emailHTML = `
        <div style="font-family: Arial; max-width: 600px;">
          <h2 style="color: #0A0E27; border-bottom: 3px solid #00D4FF;">New Contact - Engineers India</h2>
          <div style="background: #f8f9fa; padding: 20px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Company:</strong> ${company || 'Not provided'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
          </div>
          <p>Submitted: ${new Date().toLocaleString('en-IN')}</p>
        </div>
      `;

      await getTransporter().sendMail({
        from: process.env.EMAIL_USER,
        to: [ 'ei1995@gmail.com', 'gayatri.vadivu@gmail.com','info@engineersindia.in'],
        subject: `Contact: ${subject} - ${name}`,
        html: emailHTML,
        replyTo: email
      });

      console.log('Email sent');

      try {
        await sendWhatsAppAlerts('contact', company || name);
      } catch (e) {
        console.error('WhatsApp error:', e.message);
      }

      return res.status(200).json({ success: true, message: 'Message sent successfully!' });

    } catch (error) {
      console.error('Contact error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to send. Call +91 9150400011' });
    }
  });
});

// Quote form submission - USING RAWBODY FOR CLOUD FUNCTIONS V2
exports.submitQuote = functions.https.onRequest(async (req, res) => {
  console.log('=== START: Quote Request ===');
  console.log('Method:', req.method);
  
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Handle GET for testing
  if (req.method === 'GET') {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px;">
        <div style="background: #00D4FF; color: #0A0E27; padding: 20px; border-radius: 10px;">
          <h1>✅ Quote Endpoint Active</h1>
          <p>Endpoint is working and ready to receive requests.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const uploadedFiles = [];
  
  try {
    console.log('Step 1: Getting raw body...');
    
    // For Cloud Functions v2, use rawBody
    const bodyBuffer = req.rawBody || Buffer.from([]);
    console.log('Step 2: Body size:', bodyBuffer.length);
    
    if (bodyBuffer.length === 0) {
      throw new Error('Empty request body');
    }

    console.log('Step 3: Initializing busboy...');
    const Busboy = require('busboy');
    const busboy = Busboy({ headers: req.headers });
    
    const fields = {};
    const files = [];

    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
      console.log(`Field received: ${fieldname}`);
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename } = info;
      console.log(`File received: ${filename}`);
      
      const filepath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
      const writeStream = fs.createWriteStream(filepath);
      file.pipe(writeStream);

      writeStream.on('finish', () => {
        files.push({ originalname: filename, path: filepath });
        uploadedFiles.push(filepath);
        console.log(`File saved: ${filename}`);
      });
    });

    console.log('Step 4: Parsing form...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Parse timeout')), 30000);
      
      busboy.on('finish', () => {
        clearTimeout(timeout);
        console.log('Busboy finished');
        setTimeout(resolve, 100);
      });
      
      busboy.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Busboy error:', err);
        reject(err);
      });
      
      // Feed the raw body to busboy instead of piping request
      busboy.end(bodyBuffer);
    });

    console.log('Step 5: Extracting fields...');
    const { company, contact_person, email, phone, component_type, quantity, material, timeline, description } = fields;

    console.log('Received data:', { company, email, filesCount: files.length });

    if (!company || !contact_person || !email || !component_type || !description) {
      throw new Error('Missing required fields');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email');
    }

    console.log('Step 6: Building email...');
    const emailHTML = `
      <div style="font-family: Arial; max-width: 600px;">
        <h2>Quote Request - Engineers India</h2>
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0;">
          <h3>Company Information</h3>
          <p><strong>Company:</strong> ${company}</p>
          <p><strong>Contact:</strong> ${contact_person}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0;">
          <h3>Project Details</h3>
          <p><strong>Component:</strong> ${component_type}</p>
          <p><strong>Quantity:</strong> ${quantity || 'N/A'}</p>
          <p><strong>Material:</strong> ${material || 'N/A'}</p>
          <p><strong>Timeline:</strong> ${timeline || 'N/A'}</p>
          <p><strong>Description:</strong> ${description}</p>
        </div>
        ${files.length > 0 ? `<p><strong>Attached Files:</strong> ${files.length}</p>` : ''}
        <p>Submitted: ${new Date().toLocaleString('en-IN')}</p>
      </div>
    `;

    console.log('Step 7: Sending email...');
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: ['happyguy0809@gmail.com', 'ei1995@gmail.com', 'gayatri.vadivu@gmail.com'],
      subject: `Quote: ${company} - ${component_type}`,
      html: emailHTML,
      attachments: files.map(f => ({ filename: f.originalname, path: f.path }))
    });

    console.log('Step 8: Email sent successfully!');

    try {
      await sendWhatsAppAlerts('quote', company);
    } catch (e) {
      console.log('WhatsApp skipped:', e.message);
    }

    console.log('=== SUCCESS ===');
    return res.status(200).json({ 
      success: true, 
      message: 'Quote request submitted successfully! We will contact you within 24 hours.' 
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to submit. Please try again or call +91 9150400011'
    });
  } finally {
    console.log('Cleanup...');
    uploadedFiles.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    });
    console.log('=== END ===');
  }
});

// Health check
exports.health = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'Engineers India Functions'
    });
  });
});