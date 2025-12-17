const express = require('express');
const twilio = require('twilio');
const env = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const { CronJobSchdule } = require('./utils/cron')
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
env.config();
app.use(cors());
const port = process.env.SERVER_PORT


app.use('/auth', require('./auth/auth'));
app.use('/api', require('./api/api'));
app.use('/user', require('./user/api'));

mongoose.connect(process.env.MONGO_DB_KEY)
    .then(() => {
        console.log('DB Connected')
    })
    .catch(() => console.error('DB Not Connected'))
//health check
app.get('/info', (req, res) => {
    res.send('application is up and running');
})
app.listen(port, () => {
            CronJobSchdule()
    console.log(`server started at ${port}`);
})
