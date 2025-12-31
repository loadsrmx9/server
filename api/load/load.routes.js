const express = require('express');
const router = express.Router();
const jwtAuth = require('../../middleware/jwtToken');
const {searchLoad,loadDetails,myLoads,publishLoad,updateLoad,cancelLoad,deleteLoad} = require('./load.controller');


router.post('/searchLoad',jwtAuth,searchLoad);
router.get('/loadDetails/:id',jwtAuth,loadDetails);
router.post('/publishLoad',jwtAuth,publishLoad);
router.put('/updateLoad/:id',jwtAuth,updateLoad);
router.delete('/cancelLoad/:id',jwtAuth,cancelLoad);
router.delete('/deleteLoad/:id',jwtAuth,deleteLoad);
router.get('/myLoads',jwtAuth,myLoads);




module.exports = router;