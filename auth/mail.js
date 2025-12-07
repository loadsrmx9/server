const express = require('express');
const sgMail = require('@sendgrid/mail');


const router = express.Router();
sgMail.setApiKey(process.env.SGMAIL_KEY);



router.post('/send-email', (req, res) => {
    try {
        const { email } = req.body;
        const msg = {
            to: email,
            from: {
                name: 'PROJECT UNKNOWN',
                email: 'm.srinivasreddy5454@gmail.com'
            },
            subject: 'Latest loads',
            text: 'Check the latest loads',
            html: '<strong>Nearby Loads</strong>',
        }

        sgMail
            .send(msg)
            .then(() => {
                return res.status(200).json({message:"Email sent"})
            })
            .catch((error) => {
                return res.status(501).json({message:error})
            })

    } catch(error) {
        return res.status(500).json({message:error})
    }
})

module.exports = router;