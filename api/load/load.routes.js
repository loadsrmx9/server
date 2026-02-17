const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const {transporterOnly} = require('../../middleware/kycVerified');
const upload = require('../../middleware/multer')
const {searchLoad,loadDetails,myLoads,publishLoad,updateLoad,cancelLoad,deleteLoad} = require('./load.controller');


router.post('/searchLoad',jwtAuth,searchLoad);
router.get('/loadDetails/:id',jwtAuth,loadDetails);
router.post('/publishLoad',jwtAuth,transporterOnly,upload.single("image"),publishLoad);
router.put('/updateLoad/:id',jwtAuth,transporterOnly,updateLoad);
router.delete('/cancelLoad/:id',jwtAuth,transporterOnly,cancelLoad);
router.delete('/deleteLoad/:id',jwtAuth,transporterOnly,deleteLoad);
router.get('/myLoads',jwtAuth,myLoads);




module.exports = router;