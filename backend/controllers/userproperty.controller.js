const line = require("@line/bot-sdk");
const {
  UserSubProp,
  UserSubPropAddi,
  UserSubPropAddiFeat,
  PropertyAdditionalFeatures,
  SubDistrict,
  District,
  Provinces,
  PropertyType,
  PropertyPurpose,
  Sequelize,
  sequelize,
  UserSubPropGallery,
  UserFavorite,
  UserCompare,
  Users,
  Package,
} = require("../model/index.model");
const { Op } = require("sequelize");
const {
  HOST,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  NGROK,
} = require("../config/config");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
};

const client = new line.Client(config);

const createFlexMessage = (prop) => {
  let data = prop;
  let bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "baseline",
      contents: [
        {
          type: "text",
          text: "NEW PROPERTY SUBMITTED",
          color: "#ffffff",
          weight: "bold",
          style: "normal",
        },
      ],
      backgroundColor: "#1976d2",
      alignItems: "center"
    },
    hero: {
      type: "image",
      url: data.gallery,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "cover",
      action: {
        type: "uri",
        uri: prop.link,
      },
      margin: "none",
      align: "center",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: data.title,
          weight: "bold",
          size: "xl",
        },
        {
          type: "text",
          text: data.price,
          weight: "bold",
          size: "xl",
          color: "#1976d2",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: data.type,
                  wrap: true,
                  color: "#666666",
                  size: "sm",
                  flex: 5,
                },
                {
                  type: "text",
                  text: data.purpose,
                  wrap: true,
                  color: "#666666",
                  size: "sm",
                  flex: 5,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: data.address,
                  wrap: true,
                  color: "#666666",
                  size: "sm",
                  flex: 5,
                },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "link",
          height: "sm",
          action: {
            type: "uri",
            label: "WEBSITE",
            uri: data.link,
          },
        },
        {
          type: "box",
          layout: "vertical",
          contents: [],
          margin: "sm",
        },
      ],
      flex: 0,
    },
  };
  return bubble;
};


const submitProp = async (req, res) => {
  try {
    const userId = res.locals.userId;

    const dateNow = new Date();

    let userStatus = await Users.findOne({
      where: {
        id: userId,
      },
      attributes: ["packageId", "packageExpire"],
      include: [
        {
          model: Package,
          attributes: ["propertyLimit"],
        },
      ],
    });

    let packageId = userStatus.packageId;

    let packageExpire = userStatus.packageExpire;

    let propertyLimit = userStatus.package.propertyLimit;

    let propertyAmount = await UserSubProp.count({
      where: {
        userId: userId,
      },
    });

    if (dateNow >= packageExpire && packageId != 1) {
      let changePackage = await Users.update(
        {
          packageId: 1,
        },
        {
          where: {
            id: userId,
          },
        }
      );
      return res.send({
        status: 2,
        message:
          "Your package has expired. Your package now is changed to FREE, Please try again",
      }); // status 2 is for package expired and change to FREE package
    }

    if (propertyAmount >= propertyLimit) {
      return res.send({
        status: 3,
        message: "Your property listing has reached limit.",
      }); // status 3 is for fail to create post because property list has reach limit
    } else {
      let response = await UserSubProp.create({
        userId: userId,
        title: req.body.title,
        description: req.body.description,
        propFor: req.body.propFor,
        priceSale: req.body.priceSale,
        priceRent: req.body.priceRent,
        propType: req.body.propType,
        lat: req.body.lat,
        lng: req.body.lng,
        houseNo: req.body.houseNo,
        addressId: req.body.addressId,
      });

      let propertyId = await UserSubProp.findOne({
        attributes: ["id"],
        order: [["id", "desc"]],
      });

      response = await UserSubPropAddi.create({
        bedrooms: req.body.bedrooms,
        bathrooms: req.body.bathrooms,
        garages: req.body.garages,
        area: req.body.area,
        floor: req.body.floor,
        yearBuilt: req.body.yearBuilt,
        propertyId: propertyId.id,
      });

      const addiId = await UserSubPropAddi.findOne({
        order: [["id", "DESC"]],
        attributes: ["id"],
      });

      let feat_id = [];

      if (req.body.features_id) {
        if (req.body.features_id.length > 1) {
          for (let i = 0; i < req.body.features_id.length; i++) {
            feat_id.push({
              additionalId: JSON.stringify(addiId.id),
              featuresId: req.body.features_id[i],
            });
          }
        } else {
          feat_id.push({
            additionalId: JSON.stringify(addiId.id),
            featuresId: req.body.features_id,
          });
        }
      } else {
        feat_id.push({
          additionalId: JSON.stringify(addiId.id),
          featuresId: null,
        });
      }
      response = await UserSubPropAddiFeat.bulkCreate(feat_id);

      let gallery = [];

      if (req.body.gallery) {
        for (let i = 0; i < req.body.gallery.length; i++) {
          gallery.push({
            path: req.body.gallery[i],
            propertyId: propertyId.id,
          });
        }
      }

      let insertGallery = await UserSubPropGallery.bulkCreate(gallery);

      const type = await PropertyType.findOne({
        where: {
          id: req.body.propType
        },
        attributes: ['name_th']
      })

      const purpose = await PropertyPurpose.findOne({
        where: {
          id: req.body.propFor
        },
        attributes: ['name_th']
      })

      let address = await SubDistrict.findOne({
        where: {
          id: req.body.addressId
        },
        attributes: ['name_th', 'zip_code'],
        include: [
          {
            model: District,
            attributes: ['name_th'],
            include: [
              {
                model: Provinces,
                attributes: ['name_th']
              }
            ]
          }
        ]
      })
      let zipCode = address.zip_code
      let subDist= address.name_th
      let dist = address.District.name_th
      let prov = address.District.Province.name_th
      let prop = {}
      prop.title = req.body.title
      prop.type = type.name_th
      prop.purpose = purpose.name_th
      prop.priceSale = Number(req.body.priceSale)
      prop.priceRent = Number(req.body.priceRent)
      if (req.body.propType == 1) {
        prop.price = `฿ ${prop.priceSale}`;
      } else if (req.body.propType == 2) {
        prop.price = `฿ ${prop.priceRent}/เดือน`;
      } else if (req.body.propType == 3) {
        prop.price = `฿ ${prop.priceSale}, ฿ ${res.priceRent}/เดือน`;
      }
      prop.address = `${req.body.houseNo}, ${subDist}, ${dist}, ${prov}, ${zipCode}`
      prop.link = `https://127.0.0.1:4200/properties/${propertyId.id}`
      prop.gallery = `${NGROK}/images/${req.body.gallery[0]}`
      const flex = createFlexMessage(prop)
      const multiCast = { type: 'flex', altText: 'new property submitted', contents: flex }

       let user = await Users.findAll({
          attributes: ['userId']
        })
        let multiUser = []
        user.forEach((u) => {
          multiUser.push(u.userId)
        })

      client.multicast(multiUser, multiCast)

      return res.send({
        status: 1,
        message: `Submit property "${req.body.title}" successfully`,
      });
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const userRemoveProp = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const userId = res.locals.id;

    const gallery = await UserSubPropGallery.findAll({
      where: {
        propertyId: propertyId,
      },
      attributes: ["path"],
    });

    await gallery.forEach((item) => {
      try {
        let absolutePath = path.resolve("public/images/" + item.path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(String(absolutePath));
          console.log("delete " + absolutePath);
        }
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    const removeProp = await UserSubProp.destroy({
      where: {
        id: propertyId,
      },
    });

    res.send({ message: "remove property successfully" });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getUserProperties = async (req, res) => {
  try {
    // console.log(req.body);
    // console.log(req.params);
    let {
      propType,
      propFor,
      price,
      provinceId,
      districtId,
      subDistrictId,
      bedrooms,
      bathrooms,
      garages,
      area,
      floor,
      yearBuilt,
      order,
      bounds,
    } = req.body;
    // console.log(req.body.body);

    let sort = "";
    if (order) {
      if (order == "Newest(Default)") {
        sort = "order by createdAt desc";
      } else if (order == "Oldest") {
        sort = "order by createdAt asc";
      } else if (order == "Price Sale(Low to High)") {
        sort = "order by priceSale asc";
        propFor = 1;
      } else if (order == "Price Sale(High to Low)") {
        sort = "order by priceSale desc";
        propFor = 1;
      } else if (order == "Price Rent(Low to High)") {
        sort = "order by priceRent asc";
        propFor = 2;
      } else if (order == "Price Rent(High to Low)") {
        sort = "order by priceRent desc";
        propFor = 2;
      }
    } else {
      sort = "order by createdAt desc";
    }
    // console.log(order);

    const count = await sequelize.query(`
        select count(*) as length

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on user_sub_props.id = addi.propertyId

        where (((user_sub_props.lat between ${bounds.bottom} and ${bounds.top}) and (user_sub_props.lng between ${bounds.left} and ${bounds.right}))
              or ((${bounds.bottom} is null)
              and (${bounds.top} is null)
              and (${bounds.left} is null)
              and (${bounds.right} is null)))
        
        and  (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
      `);

    const prop = await sequelize.query(
      `select  user_sub_props.id as id,
                 user_sub_props.title as title,
                 user_sub_props.description as description,
                 user_sub_props.priceSale as priceSale,
                 user_sub_props.priceRent as priceRent,
                 
                 user_sub_props.lat as lat,
                 user_sub_props.lng as lng,
                 user_sub_props.houseNo as houseNo,
                 user_sub_props.createdAt as createdAt,
                 user_sub_props.updatedAt as updatedAt,

                 propPurpose.name_th as purpose_nameth,
                 propPurpose.name_en as purpose_nameen,

                 propType.name_th as type_nameth,
                 propType.name_en as type_nameen,
          
                 provinces.id as prov_id,
                 provinces.name_th as prov_nameth,
                 provinces.name_en as prov_nameen,  

                 districts.id as dist_id,
                 districts.name_th as dist_nameth,
                 districts.name_en as dist_nameen,

                 subdistricts.id as subDist_id,
                 subdistricts.name_th as subDist_nameth, 
                 subdistricts.name_en as subDist_nameen, 
                 subdistricts.zip_code as zipcode,    
                          
                 addi.bedrooms as bedrooms,
                 addi.bathrooms as bathrooms,       
                 addi.garages as garages,
                 addi.area as area,      
                 addi.floor as floor, 
                 addi.yearBuilt as yearBuilt

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on user_sub_props.id = addi.propertyId

        where (((user_sub_props.lat between ${bounds.bottom} and ${bounds.top}) and (user_sub_props.lng between ${bounds.left} and ${bounds.right}))
              or ((${bounds.bottom} is null)
              and (${bounds.top} is null)
              and (${bounds.left} is null)
              and (${bounds.right} is null)))
        
        and (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
        `
    );

    const marker = await sequelize.query(
      `select  user_sub_props.id as id,
                 user_sub_props.title as title,
                 user_sub_props.description as description,
                 user_sub_props.priceSale as priceSale,
                 user_sub_props.priceRent as priceRent,
                 user_sub_props.lat as lat,
                 user_sub_props.lng as lng

        from user_sub_props

        inner join property_purposes on user_sub_props.propFor = property_purposes.id
        inner join property_types on user_sub_props.propType = property_types.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals  on user_sub_props.id = user_sub_prop_additionals.propertyId

        where (((user_sub_props.lat between ${bounds.bottom} and ${bounds.top}) and (user_sub_props.lng between ${bounds.left} and ${bounds.right}))
              or ((${bounds.bottom} is null)
              and (${bounds.top} is null)
              and (${bounds.left} is null)
              and (${bounds.right} is null)))
        
        and (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((user_sub_prop_additionals.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (user_sub_prop_additionals.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (user_sub_prop_additionals.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((user_sub_prop_additionals.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (user_sub_prop_additionals.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (user_sub_prop_additionals.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((user_sub_prop_additionals.garages >= ${garages.from} and ${garages.to} is null) 
            or (user_sub_prop_additionals.garages <= ${garages.to} and ${garages.from} is null)
            or (user_sub_prop_additionals.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((user_sub_prop_additionals.area >= ${area.from} and ${area.to} is null) 
            or (user_sub_prop_additionals.area <= ${area.to} and ${area.from} is null)
            or (user_sub_prop_additionals.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((user_sub_prop_additionals.floor >= ${floor.from} and ${floor.to} is null) 
            or (user_sub_prop_additionals.floor <= ${floor.to} and ${floor.from} is null)
            or (user_sub_prop_additionals.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((user_sub_prop_additionals.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (user_sub_prop_additionals.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (user_sub_prop_additionals.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} 
        
        `
    );

    let response = prop[0];

    let propertyId = [];

    response.forEach((res) => {
      res.gallery = [];
      propertyId.push(res.id);
    });

    let propGallery = await UserSubPropGallery.findAll({
      attributes: ["path", "propertyId"],
      where: {
        propertyId: { [Op.in]: propertyId },
      },
    });

    response.forEach((res) => {
      propGallery.forEach((gallery) => {
        if (res.id == gallery.propertyId) {
          res.gallery.push(`${HOST}/images/` + gallery.path);
        }
      });
    });

    response.forEach((res) => {
      res.gallery = res.gallery.reverse();
    });

    const icon = marker[0];
    let propertyIdMarker = [];

    icon.forEach((item) => {
      item.gallery = [];
      propertyIdMarker.push(item.id);
    });

    let propGalleryMarker = await UserSubPropGallery.findAll({
      attributes: ["path", "propertyId"],
      where: {
        propertyId: { [Op.in]: propertyIdMarker },
      },
    });

    icon.forEach((item) => {
      propGalleryMarker.forEach((gallery) => {
        if (item.id == gallery.propertyId) {
          item.gallery.push(`${HOST}/images/` + gallery.path);
        }
      });
    });

    icon.forEach((item) => {
      item.gallery = item.gallery.reverse();
      for (let i = item.gallery.length - 1; i > 0; i--) {
        item.gallery.pop();
      }
    });

    // console.log(icon);
    // console.log(response);
    res.send({ count: count[0], data: response, marker: icon });
  } catch (err) {
    res.status(500).send(err.message);
  }
};
const getUserPropertyById = async (req, res) => {
  try {
    let response = await sequelize.query(
      `select user_sub_props.id as id,
              user_sub_props.title as title,
              user_sub_props.description as description,
              user_sub_props.priceSale as priceSale,
              user_sub_props.priceRent as priceRent,
              
              user_sub_props.lat as lat,
              user_sub_props.lng as lng,
              user_sub_props.houseNo as houseNo,
              user_sub_props.createdAt as createdAt,
              user_sub_props.updatedAt as updatedAt,
              
              propPurpose.name_th as purpose_nameth,
              propPurpose.name_en as purpose_nameen,
              
              propType.name_th as type_nameth,
              propType.name_en as type_nameen,
              
              provinces.id as prov_id,
              provinces.name_th as prov_nameth,
              provinces.name_en as prov_nameen,  
              
              districts.id as dist_id,
              districts.name_th as dist_nameth,
              districts.name_en as dist_nameen,
              
              subdistricts.id as subDist_id,
              subdistricts.name_th as subDist_nameth, 
              subdistricts.name_en as subDist_nameen, 
              subdistricts.zip_code as zipcode,    
              
              addi.id as additionalId,
              addi.bedrooms as bedrooms,
              addi.bathrooms as bathrooms,       
              addi.garages as garages,
              addi.area as area,      
              addi.floor as floor, 
              addi.yearBuilt as yearBuilt

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on user_sub_props.id = addi.propertyId
              
         where user_sub_props.id = ${req.params.id}     
      `
    );
    const addiId = response[0][0].additionalId;

    let featuresList = [];
    let featuresId = await sequelize.query(
      `select user_sub_prop_additional_features.featuresId	
          from user_sub_prop_additional_features
          WHERE additionalId = ${addiId}
        `
    );

    featuresId[0].forEach((feat) => {
      featuresList.push(feat.featuresId);
    });

    let features = await PropertyAdditionalFeatures.findAll({
      attributes: ["name_th", "name_en", "selected"],
      where: { id: { [Op.in]: featuresList } },
    });

    response = response[0][0];

    response.features = [];
    features.forEach((feat) => {
      feat.selected = true;
      response.features.push(feat);
    });

    let propGallery = await UserSubPropGallery.findAll({
      attributes: ["path", "propertyId"],
      where: {
        propertyId: req.params.id,
      },
    });

    response.gallery = [];
    propGallery.forEach((gallery) => {
      response.gallery.push(`${HOST}/images/${gallery.path}`);
    });

    response.gallery = response.gallery.reverse();

    let agent = await sequelize.query(
      `
        select users.id as id,
               users.displayName as displayName,
               users.fname as fname,
               users.lname as lname,
               users.pictureUrl as picture,

               detail.email as email,
               detail.phone as phone,
               detail.organization as organization,
               detail.facebook as facebook,
               detail.lineID as lineID,
               detail.instagram as instagram,
               detail.website as website

        from user_sub_props

        inner join users on users.id = user_sub_props.userId
        inner join user_account_details detail on users.id = detail.userId
        

        where user_sub_props.id = ${req.params.id}
      `
    );
    agent = agent[0][0];
    if (agent.picture.length < 20) {
      agent.picture = `${HOST}/images/${agent.picture}`;
    }
    res.send({ property: response, agent: agent });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getUserPropertiesHome = async (req, res) => {
  try {
    let {
      propType,
      propFor,
      price,
      provinceId,
      districtId,
      subDistrictId,
      bedrooms,
      bathrooms,
      garages,
      area,
      floor,
      yearBuilt,
      order,
    } = req.body;
    console.log(req.body);

    let sort = "";
    if (order) {
      if (order == "Newest(Default)") {
        sort = "order by createdAt desc";
      } else if (order == "Oldest") {
        sort = "order by createdAt asc";
      } else if (order == "Price Sale(Low to High)") {
        sort = "order by priceSale asc";
        propFor = 1;
      } else if (order == "Price Sale(High to Low)") {
        sort = "order by priceSale desc";
        propFor = 1;
      } else if (order == "Price Rent(Low to High)") {
        sort = "order by priceRent asc";
        propFor = 2;
      } else if (order == "Price Rent(High to Low)") {
        sort = "order by priceRent desc";
        propFor = 2;
      }
    } else {
      sort = "order by createdAt desc";
    }
    // console.log(order);

    const count = await sequelize.query(`
        select count(*) as length

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on addi.propertyId = user_sub_props.id

        where (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
      `);

    const prop = await sequelize.query(
      `select  user_sub_props.id as id,
                 user_sub_props.title as title,
                 user_sub_props.description as description,
                 user_sub_props.priceSale as priceSale,
                 user_sub_props.priceRent as priceRent,
                 
                 user_sub_props.lat as lat,
                 user_sub_props.lng as lng,
                 user_sub_props.houseNo as houseNo,
                 user_sub_props.createdAt as createdAt,
                 user_sub_props.updatedAt as updatedAt,

                 propPurpose.name_th as purpose_nameth,
                 propPurpose.name_en as purpose_nameen,

                 propType.name_th as type_nameth,
                 propType.name_en as type_nameen,
          
                 provinces.id as prov_id,
                 provinces.name_th as prov_nameth,
                 provinces.name_en as prov_nameen,  

                 districts.id as dist_id,
                 districts.name_th as dist_nameth,
                 districts.name_en as dist_nameen,

                 subdistricts.id as subDist_id,
                 subdistricts.name_th as subDist_nameth, 
                 subdistricts.name_en as subDist_nameen, 
                 subdistricts.zip_code as zipcode,    
                          
                 addi.bedrooms as bedrooms,
                 addi.bathrooms as bathrooms,       
                 addi.garages as garages,
                 addi.area as area,      
                 addi.floor as floor, 
                 addi.yearBuilt as yearBuilt

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on addi.propertyId = user_sub_props.id

        where (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
        `
    );

    let response = prop[0];

    let propertyId = [];

    response.forEach((res) => {
      res.gallery = [];
      propertyId.push(res.id);
    });

    let propGallery = await UserSubPropGallery.findAll({
      attributes: ["path", "propertyId"],
      where: {
        propertyId: { [Op.in]: propertyId },
      },
    });

    response.forEach((res) => {
      propGallery.forEach((gallery) => {
        if (res.id == gallery.propertyId) {
          res.gallery.push(`${HOST}/images/` + gallery.path);
        }
      });
    });

    response.forEach((res) => {
      res.gallery = res.gallery.reverse();
    });

    res.send({ count: count[0], data: response });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getPropertiesbyAgent = async (req, res) => {
  try {
    let {
      propType,
      propFor,
      price,
      provinceId,
      districtId,
      subDistrictId,
      bedrooms,
      bathrooms,
      garages,
      area,
      floor,
      yearBuilt,
      order,
    } = req.body;
    console.log(req.body);

    let sort = "";
    if (order) {
      if (order == "Newest(Default)") {
        sort = "order by createdAt desc";
      } else if (order == "Oldest") {
        sort = "order by createdAt asc";
      } else if (order == "Price Sale(Low to High)") {
        sort = "order by priceSale asc";
        propFor = 1;
      } else if (order == "Price Sale(High to Low)") {
        sort = "order by priceSale desc";
        propFor = 1;
      } else if (order == "Price Rent(Low to High)") {
        sort = "order by priceRent asc";
        propFor = 2;
      } else if (order == "Price Rent(High to Low)") {
        sort = "order by priceRent desc";
        propFor = 2;
      }
    } else {
      sort = "order by createdAt desc";
    }
    // console.log(order);

    const count = await sequelize.query(`
        select count(*) as length

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on user_sub_props.id = addi.propertyId

        where (user_sub_props.userId = ${req.params.id})

        and (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
      `);

    const prop = await sequelize.query(
      `select  user_sub_props.id as id,
                 user_sub_props.title as title,
                 user_sub_props.description as description,
                 user_sub_props.priceSale as priceSale,
                 user_sub_props.priceRent as priceRent,
                 
                 user_sub_props.lat as lat,
                 user_sub_props.lng as lng,
                 user_sub_props.houseNo as houseNo,
                 user_sub_props.createdAt as createdAt,
                 user_sub_props.updatedAt as updatedAt,

                 propPurpose.name_th as purpose_nameth,
                 propPurpose.name_en as purpose_nameen,

                 propType.name_th as type_nameth,
                 propType.name_en as type_nameen,
          
                 provinces.id as prov_id,
                 provinces.name_th as prov_nameth,
                 provinces.name_en as prov_nameen,  

                 districts.id as dist_id,
                 districts.name_th as dist_nameth,
                 districts.name_en as dist_nameen,

                 subdistricts.id as subDist_id,
                 subdistricts.name_th as subDist_nameth, 
                 subdistricts.name_en as subDist_nameen, 
                 subdistricts.zip_code as zipcode,    
                          
                 addi.bedrooms as bedrooms,
                 addi.bathrooms as bathrooms,       
                 addi.garages as garages,
                 addi.area as area,      
                 addi.floor as floor, 
                 addi.yearBuilt as yearBuilt

        from user_sub_props

        inner join property_purposes propPurpose on user_sub_props.propFor = propPurpose.id
        inner join property_types propType on user_sub_props.propType = propType.id
        inner join subdistricts on user_sub_props.addressId = subdistricts.id 
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join user_sub_prop_additionals addi on user_sub_props.id = addi.propertyId

        where (user_sub_props.userId = ${req.params.id})

        and (propType = ${propType} or ${propType} is null)

        and (propFor = ${propFor} or ${propFor} is null)

        and (((priceSale >= ${price.from} and ${price.to} is null) 
            or (priceSale <= ${price.to} and priceSale != 0 and ${price.from} is null)
            or (priceSale between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null))
        or ((priceRent >= ${price.from} and ${price.to} is null) 
            or (priceRent <= ${price.to} and priceRent != 0 and ${price.from} is null)
            or (priceRent between ${price.from} and ${price.to})  
            or (${price.from} is null and ${price.to} is null)))
        and (provinces.id = ${provinceId} or ${provinceId} is null)

        and (districts.id = ${districtId} or ${districtId} is null)

        and (subdistricts.id = ${subDistrictId} or ${subDistrictId} is null)

        and ((addi.bedrooms >= ${bedrooms.from} and ${bedrooms.to} is null) 
            or (addi.bedrooms <= ${bedrooms.to} and ${bedrooms.from} is null)
            or (addi.bedrooms between ${bedrooms.from} and ${bedrooms.to})  
            or (${bedrooms.from} is null and ${bedrooms.to} is null))

        and ((addi.bathrooms >= ${bathrooms.from} and ${bathrooms.to} is null) 
            or (addi.bathrooms <= ${bathrooms.to} and ${bathrooms.from} is null)
            or (addi.bathrooms between ${bathrooms.from} and ${bathrooms.to})  
            or (${bathrooms.from} is null and ${bathrooms.to} is null))

        and ((addi.garages >= ${garages.from} and ${garages.to} is null) 
            or (addi.garages <= ${garages.to} and ${garages.from} is null)
            or (addi.garages between ${garages.from} and ${garages.to})  
            or (${garages.from} is null and ${garages.to} is null))

        and ((addi.area >= ${area.from} and ${area.to} is null) 
            or (addi.area <= ${area.to} and ${area.from} is null)
            or (addi.area between ${area.from} and ${area.to})  

            or (${area.from} is null and ${area.to} is null))
        and ((addi.floor >= ${floor.from} and ${floor.to} is null) 
            or (addi.floor <= ${floor.to} and ${floor.from} is null)
            or (addi.floor between ${floor.from} and ${floor.to})  
            or (${floor.from} is null and ${floor.to} is null))

        and ((addi.yearBuilt >= ${yearBuilt.from} and ${yearBuilt.to} is null) 
            or (addi.yearBuilt <= ${yearBuilt.to} and ${yearBuilt.from} is null)
            or (addi.yearBuilt between ${yearBuilt.from} and ${yearBuilt.to})  
            or (${yearBuilt.from} is null and ${yearBuilt.to} is null))
        
        ${sort} limit ${req.params.perPage} offset ${req.params.page}
        `
    );

    let response = prop[0];

    let propertyId = [];

    response.forEach((res) => {
      res.gallery = [];
      propertyId.push(res.id);
    });

    let propGallery = await UserSubPropGallery.findAll({
      attributes: ["path", "propertyId"],
      where: {
        propertyId: { [Op.in]: propertyId },
      },
    });

    response.forEach((res) => {
      propGallery.forEach((gallery) => {
        if (res.id == gallery.propertyId) {
          res.gallery.push(`${HOST}/images/` + gallery.path);
        }
      });
    });

    response.forEach((res) => {
      res.gallery = res.gallery.reverse();
    });

    res.send({ count: count[0], data: response });
  } catch (err) {
    res.status(err.message);
  }
};

const getMyproperties = async (req, res) => {
  try {
    const userId = res.locals.userId;

    let myProp = await UserSubProp.findAll({
      where: {
        userId: userId,
      },
      attributes: ["id", "title", "createdAt"],
      include: [
        {
          model: UserSubPropGallery,
          attributes: ["path"],
        },
      ],
      order: [["createdAt", "desc"]],
    });

    let data = [];
    myProp.forEach((prop) => {
      let temp = {};
      temp.id = prop.id;
      temp.title = prop.title;
      temp.published = prop.createdAt;
      temp.image = `${HOST}/images/${
        prop.user_sub_prop_galleries[prop.user_sub_prop_galleries.length - 1]
          .path
      }`;
      data.push(temp);
    });
    res.send({ data: data });
  } catch (err) {
    res.status(500).send(err.message);
  }
};
const getMyFavorites = async (req, res) => {
  try {
    const userId = res.locals.userId;

    let myFav = await UserFavorite.findAll({
      where: {
        userId: userId,
      },
      include: [
        {
          model: UserSubProp,
          attributes: ["id", "title", "createdAt"],
          include: [
            {
              model: UserSubPropGallery,
              attributes: ["path"],
            },
          ],
        },
      ],
      order: [["id", "desc"]],
    });

    let data = [];
    myFav.forEach((fav) => {
      let temp = {};
      (temp.id = fav.propertyId),
        (temp.title = fav.user_sub_prop.title),
        (temp.published = fav.user_sub_prop.createdAt);
      temp.image = `${HOST}/images/${
        fav.user_sub_prop.user_sub_prop_galleries[
          fav.user_sub_prop.user_sub_prop_galleries.length - 1
        ].path
      }`;
      data.push(temp);
    });
    res.send({ data: data });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getEditPropertyById = async (req, res) => {
  try {
    const userId = res.locals.userId;
    const property = await UserSubProp.findOne({
      where: {
        userId: userId,
        id: req.params.id,
      },
      attributes: [
        "id",
        "title",
        "description",
        "propFor",
        "propType",
        "priceSale",
        "priceRent",
        "lat",
        "lng",
        "houseNo",
      ],
      include: [
        {
          model: SubDistrict,
          attributes: ["id"],
          include: [
            {
              model: District,
              attributes: ["id"],
              include: [
                {
                  model: Provinces,
                  attributes: ["id"],
                },
              ],
            },
          ],
        },
        {
          model: UserSubPropAddi,
          attributes: [
            "bedrooms",
            "bathrooms",
            "garages",
            "area",
            "yearBuilt",
            "floor",
          ],
          include: [
            {
              model: UserSubPropAddiFeat,
              attributes: ["id"],
              include: [
                {
                  model: PropertyAdditionalFeatures,
                  attributes: ["id"],
                },
              ],
            },
          ],
        },
        {
          model: UserSubPropGallery,
          attributes: ["path"],
        },
      ],
    });

    let features = [];
    property.user_sub_prop_additional[
      "user_sub_prop_additional_features"
    ].forEach((feat) => {
      if (feat.property_additional_feature != null) {
        features.push(feat.property_additional_feature.id);
      }
    });

    let gallery = [];
    property.user_sub_prop_galleries.forEach((res) => {
      gallery.push(`${HOST}/images/${res.path}`);
    });

    let data = {};
    data.id = property.id;
    data.title = property.title;
    data.desc = property.description;
    data.propFor = property.propFor;
    data.propType = property.propType;
    data.priceSale = property.priceSale;
    data.priceRent = property.priceRent;
    data.lat = property.lat;
    data.lng = property.lng;
    data.houseNo = property.houseNo;
    data.subDistrict = property.SubDistrict.id;
    data.district = property.SubDistrict.District["id"];
    data.province = property.SubDistrict.District.Province["id"];
    data.bedrooms = property.user_sub_prop_additional.bedrooms;
    data.bathrooms = property.user_sub_prop_additional.bathrooms;
    data.garages = property.user_sub_prop_additional.garages;
    data.area = property.user_sub_prop_additional.area;
    data.yearBuilt = property.user_sub_prop_additional.yearBuilt;
    data.floor = property.user_sub_prop_additional.floor;
    data.features = features;
    data.gallery = gallery;
    res.send({ data: data });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const updateUserProp = async (req, res) => {
  try {
    const userId = res.locals.userId;
    const propertyId = req.params.propertyId;
    // console.log(req.body);
    if (req.body.delImage) {
      if (req.body.delImage.legnth > 1) {
        req.body.delImage.forEach((del) => {
          let absolutePath = path.resolve("public/images/" + del);
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
          }
        });
        const removeImage = await UserSubPropGallery.destroy({
          where: {
            path: { [Op.in]: req.body.delImage },
          },
        });
      } else {
        let absolutePath = path.resolve("public/images/" + req.body.delImage);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
        const removeImage = await UserSubPropGallery.destroy({
          where: {
            path: req.body.delImage,
          },
        });
      }
    }
    const updateProperty = await UserSubProp.update(
      {
        title: req.body.title,
        description: req.body.description,
        propFor: req.body.propFor,
        priceSale: req.body.priceSale,
        priceRent: req.body.priceRent,
        propType: req.body.propType,
        lat: req.body.lat,
        lng: req.body.lng,
        houseNo: req.body.houseNo,
      },
      {
        where: {
          id: propertyId,
          userId: userId,
        },
      }
    );

    let addiId = await UserSubPropAddi.findOne({
      where: {
        propertyId: propertyId,
      },
      attributes: ["id"],
    });
    addiId = addiId.id;
    // console.log(addiId);
    const removeFeatures = await UserSubPropAddiFeat.destroy({
      where: {
        additionalId: addiId,
      },
    });

    const updateAdditional = await UserSubPropAddi.update(
      {
        bedrooms: req.body.bedrooms,
        bathrooms: req.body.bathrooms,
        garages: req.body.garages,
        area: req.body.area,
        floor: req.body.floor,
        yearBuilt: req.body.yearBuilt,
      },
      {
        where: {
          propertyId: propertyId,
        },
      }
    );

    let features = [];
    if (req.body.featuresId) {
      if (req.body.featuresId.length > 1) {
        req.body.featuresId.forEach((feat) => {
          features.push({
            additionalId: addiId,
            featuresId: feat,
          });
        });
      } else {
        features.push({
          additionalId: addiId,
          featuresId: req.body.featuresId,
        });
      }
    } else {
      features.push({
        additionalId: addiId,
        featuresId: null,
      });
    }

    const updateFeatures = await UserSubPropAddiFeat.bulkCreate(features);

    let gallery = [];

    if (req.body.gallery) {
      for (let i = 0; i < req.body.gallery.length; i++) {
        gallery.push({
          path: req.body.gallery[i],
          propertyId: propertyId,
        });
      }
      const insertGallery = await UserSubPropGallery.bulkCreate(gallery);
    }

    res.send({ status: 1, message: "updated property successfully" }); // status 1 is for updated success
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const removeFromFavorite = async (req, res) => {
  try {
    const userId = res.locals.userId;
    const propertyId = req.params.propertyId;
    const remove = await UserFavorite.destroy({
      where: {
        propertyId: propertyId,
        userId: userId,
      },
    });

    res.send({ status: 1, message: "deleted from favorite list successfully" });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const getUserCompare = async (req, res) => {
  try {
    const userId = res.locals.userId;

    const myCompare = await UserCompare.findAll({
      where: {
        userId: userId,
      },
      include: [
        {
          model: UserSubProp,
          attributes: { exclude: ["additionalId", "addressId"] },
          include: [
            {
              model: UserSubPropAddi,
              include: [
                {
                  model: UserSubPropAddiFeat,
                  attributes: ["featuresId"],
                },
              ],
            },
            {
              model: SubDistrict,
              attributes: ["name_th", "name_en", "zip_code"],
              include: [
                {
                  model: District,
                  attributes: ["name_th", "name_en"],
                  include: [
                    {
                      model: Provinces,
                      attributes: ["name_th", "name_en"],
                    },
                  ],
                },
              ],
            },
            {
              model: UserSubPropGallery,
              attributes: ["path"],
            },
            {
              model: PropertyPurpose,
              attributes: ["name_th", "name_en"],
            },
            {
              model: PropertyType,
              attributes: ["name_th", "name_en"],
            },
          ],
        },
      ],
      order: [["id", "desc"]],
    });

    let data = [];
    myCompare.forEach((compare) => {
      let temp = {};
      temp.id = compare.propertyId;
      temp.title = compare.user_sub_prop.title;
      temp.description = compare.user_sub_prop.description;
      temp.priceSale = compare.user_sub_prop.priceSale;
      temp.priceRent = compare.user_sub_prop.priceRent;
      temp.lat = compare.user_sub_prop.lat;
      temp.lng = compare.user_sub_prop.lng;
      temp.houseNo = compare.user_sub_prop.houseNo;
      temp.createdAt = compare.user_sub_prop.createdAt;
      temp.updatedAt = compare.user_sub_prop.updatedAt;
      temp.bedrooms = compare.user_sub_prop.user_sub_prop_additional.bedrooms;
      temp.bathrooms = compare.user_sub_prop.user_sub_prop_additional.bathrooms;
      temp.garages = compare.user_sub_prop.user_sub_prop_additional.garages;
      temp.area = compare.user_sub_prop.user_sub_prop_additional.area;
      temp.floor = compare.user_sub_prop.user_sub_prop_additional.floor;
      temp.yearBuilt = compare.user_sub_prop.user_sub_prop_additional.yearBuilt;
      temp.features = [];
      compare.user_sub_prop.user_sub_prop_additional.user_sub_prop_additional_features.forEach(
        (feat) => {
          temp.features.push(feat.featuresId);
        }
      );
      temp.zipcode = compare.user_sub_prop.SubDistrict.zip_code;
      temp.subDist_nameth = compare.user_sub_prop.SubDistrict.name_th;
      temp.subDist_nameen = compare.user_sub_prop.SubDistrict.name_en;
      temp.dist_nameth = compare.user_sub_prop.SubDistrict.District.name_th;
      temp.dist_nameen = compare.user_sub_prop.SubDistrict.District.name_en;
      temp.prov_nameth =
        compare.user_sub_prop.SubDistrict.District.Province.name_th;
      temp.prov_nameen =
        compare.user_sub_prop.SubDistrict.District.Province.name_en;
      temp.purpose_nameth = compare.user_sub_prop.property_purpose.name_th;
      temp.purpose_nameen = compare.user_sub_prop.property_purpose.name_en;
      temp.type_nameth = compare.user_sub_prop.property_type.name_th;
      temp.type_nameen = compare.user_sub_prop.property_type.name_en;
      temp.gallery = `${HOST}/images/${compare.user_sub_prop.user_sub_prop_galleries[0].path}`;
      data.push(temp);
    });

    res.send({ data: data });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const removeFromCompareById = async (req, res) => {
  try {
    const userId = res.locals.userId;

    const remove = await UserCompare.destroy({
      where: {
        userId: userId,
        propertyId: req.params.propertyId,
      },
    });
    res.send({ status: 1, message: "deleted from compare list successfully" });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const clearAllCompare = async (req, res) => {
  try {
    const userId = res.locals.userId;

    const clear = await UserCompare.destroy({
      where: {
        userId: userId,
      },
    });

    res.send({ status: 1, message: "clear all compare list successfully" });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

module.exports = {
  getUserProperties: getUserProperties,
  getUserPropertiesHome: getUserPropertiesHome,
  getUserPropertyById: getUserPropertyById,
  submitProp: submitProp,
  getPropertiesbyAgent: getPropertiesbyAgent,
  getMyproperties: getMyproperties,
  userRemoveProp: userRemoveProp,
  getEditPropertyById: getEditPropertyById,
  updateUserProp: updateUserProp,
  getMyFavorites: getMyFavorites,
  removeFromFavorite: removeFromFavorite,
  getUserCompare: getUserCompare,
  removeFromCompareById: removeFromCompareById,
  clearAllCompare: clearAllCompare,
};
