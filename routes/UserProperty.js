const express = require('express')
const router = express.Router();
const validator = require('../services/validator/validator')
const controller = require('../controllers/userproperty.controller')


const multer = require('../services/multer/multer')

//POST: submit property
router.post('/submitProp', validator.verify, multer.uploadImages, multer.resizeImagesProperty, multer.getResult, controller.submitProp)

router.get('/checkUserInfoBeforeSubmit', validator.verify, controller.checkUserInfoBeforeSubmit)

router.post('/getUserProperties/:page/:perPage', controller.getUserProperties)

router.get('/getUserPropertyById/:id', controller.getUserPropertyById)

router.post('/getUserPropertiesHome/:page/:perPage', controller.getUserPropertiesHome)

router.post('/getUserPropertiesbyAgent/:page/:perPage/:id', controller.getPropertiesbyAgent)

router.get('/checkUserOwnProperty/:propertyId', validator.verify, controller.checkUserOwnProperty)

router.get('/getMyproperties', validator.verify, controller.getMyproperties)

router.get('/getMyFavorites', validator.verify, controller.getMyFavorites)

router.post('/userRemoveProp/:propertyId', validator.verify, controller.userRemoveProp)

router.get('/getEditPropertyById/:id', validator.verify, controller.getEditPropertyById)

router.post('/updateUserProp/:propertyId', validator.verify, multer.uploadImages, multer.resizeImagesProperty, multer.getResult, controller.updateUserProp)

router.post('/removeFromFavorite/:propertyId', validator.verify, controller.removeFromFavorite)

router.get('/getUserCompare', validator.verify, controller.getUserCompare)

router.post('/removeFromCompareById/:propertyId', validator.verify, controller.removeFromCompareById)

router.post('/clearAllCompare', validator.verify, controller.clearAllCompare)

router.post('/userChangePropertyStatus/:propertyId', validator.verify, controller.userChangePropertyStatus)

router.post('/userChangeSaleStatus/:propertyId', validator.verify, controller.userChangeSaleStatus)



module.exports = router