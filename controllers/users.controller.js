const {
  SECRET,
  HOST,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  NGROK,
  LINE_NOTIFY_KEY ,
  ADMIN_PATH
} = require("../config/config");
const line = require("@line/bot-sdk");
const lineNotify = require("line-notify-nodejs")(
  LINE_NOTIFY_KEY 
);
const {
  Users,
  Roles,
  Package,
  UserFavorite,
  UserCompare,
  UserAccountDetails,
  UserSubProp,
  UserRequirement,
  UserReportProperty,
  sequelize,
  UserReportUser,
  MoneyTransfer,
  UserSubPropGallery,
  Sequelize,
  SubscriptionPeriod,
  Promotions,
} = require("../model/index.model");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

const config = {
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
};

const client = new line.Client(config);
module.exports = {
  login: async (req, res) => {
    try {
      console.log(req.body);
      let existUser = await Users.findOne({
        where: { userId: req.body.userId },
      });
      let response;

      let packageId = req.body.packageId
      
      let packageExpireDate = req.body.packageExpire

      
      if (!existUser) {
        let promotion = await Promotions.findOne({
          where: {
            code: 'debut' || 'DEBUT',
            id: 1,
            displayStatus: true || 1
          }
        })

        if (promotion) {
          let dateNow = new Date()
          if (dateNow < new Date(promotion.dateEnd)) {
            packageId = 4
            packageExpireDate = promotion.dateEnd
          }
        }

        response = await Users.create({
          userId: req.body.userId,
          displayName: req.body.displayName,
          fname: "",
          lname: "",
          pictureUrl: "",
          packageId: packageId,
          roleId: req.body.roleId,
          subscriptionPeriodId: req.body.subscriptionPeriodId,
          packageExpire: packageExpireDate,
          displayStatus: 1
        });

        let userLatest = await Users.findOne({
          where: {
            userId: req.body.userId,
          },
          attributes: ["id"],
        });

        let createDetail = await UserAccountDetails.create({
          userId: userLatest.id,
          email: null,
          phone: null,
          organization: null,
        });

        let packageExpire = await Users.findOne({
          where: {
            id: userLatest.id,
            packageId: { [Op.ne]: 1 }
          },
          attributes: ['packageExpire']
        })
        if (packageExpire) {
          packageExpire = packageExpire.packageExpire
        }  
        
        let token = jwt.sign({ userId: response.id }, SECRET, {
          expiresIn: "2h",
        });
        res.send({ status: 1, token: token, packageExpire: packageExpire });
      } else {

        let bannedUser = await Users.findOne({
          attributes: ['id'],
          where: {
            userId: req.body.userId,
            displayStatus: 0 || false
          }
        })

        if (bannedUser) {
          return res.send({ status: 2 , 
            message: 
            `ALERT.BANNED_USER`})
        }

        let packageExpire = await Users.findOne({
          where: {
            userId: req.body.userId,
            packageId: { [Op.ne]: 1 }
          },
          attributes: ['packageExpire']
        })
        if (packageExpire) {
          packageExpire = packageExpire.packageExpire
        }  
        let token = jwt.sign({ userId: existUser.id}, SECRET, {
          expiresIn: "2h",
        });
        res.send({ status: 1, token: token, packageExpire: packageExpire });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  addToFavorite: async (req, res) => {
    try {
      const userId = res.locals.userId;

      const existFavorite = await UserFavorite.findOne({
        where: {
          userId: userId,
          propertyId: req.params.propertyId,
        },
      });

      // console.log(existFavorite);
      if (existFavorite) {
        const del = await UserFavorite.destroy({
          where: {
            userId: userId,
            propertyId: req.params.propertyId,
          },
        });
        return res.send({
          message: "ALERT.DELETE_FROM_FAVORITE",
          status: 2,
        }); // status 2 is for delete from favorite
      } else {
        const add = await UserFavorite.create({
          userId: userId,
          propertyId: req.params.propertyId,
        });
      }

      res.send({ message: `ALERT.ADD_TO_FAVORITE`, status: 1 }); // status 1 is for add to favorite
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  addToCompare: async (req, res) => {
    try {
      const userId = res.locals.userId;

      const existCompare = await UserCompare.findOne({
        where: {
          userId: userId,
          propertyId: req.params.propertyId,
        },
      });

      if (existCompare) {
        const del = await UserCompare.destroy({
          where: {
            userId: userId,
            propertyId: req.params.propertyId,
          },
        });
        return res.status(200).send({
          message: "ALERT.DELETE_FROM_COMPARE",
          status: 2,
        }); // status 2 is for remove from compare list
      } else {
        const add = await UserCompare.create({
          userId: userId,
          propertyId: req.params.propertyId,
        });
      }

      res
        .status(201)
        .send({ message: `ALERT.ADD_TO_COMPARE`, status: 1 }); // status 1 is for add to compare list
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
  getAgentById: async (req, res) => {
    try {
      const response = await Users.findOne({
        where: {
          id: req.params.id,
        },
        attributes: ["id", "displayName", "fname", "lname", "pictureUrl", 'displayStatus','packageId', 'packageExpire'],
        include: [
          {
            model: UserAccountDetails,
            attributes: ["email", "phone", "organization"],
          },
          {
            model: UserSubProp,
            attributes: ['id'],
          }
        ],
      });

      let dateNow = new Date()
      if (response.displayStatus == 0 || 
        response.displayStatus == false || 
        (response.packageId != 1 && dateNow >= response.packageExpire) || 
        response.user_sub_props.length == 0) {
        return res.send({ status: 2 , message: 'ALERT.NO_USER_EXIST' }) // status 2 is for user got banned or user package expired(cant watch profile) 
      }

      let data = {};
      data.id = response.id;
      data.displayName = response.displayName;
      data.fname = response.fname;
      data.lname = response.lname;
      if (response.pictureUrl != null && response.pictureUrl != '') {
        data.picture = `${HOST}/images/avatar/${response.pictureUrl}`;
      } else {
        data.picture = `${HOST}/images/avatar/default.jpg`;;
      }
      data.email = response.user_account_detail["email"];
      data.phone = response.user_account_detail["phone"];
      data.organization = response.user_account_detail["organization"];

      const count = await UserSubProp.count({
        where: {
          userId: req.params.id,
          displayStatus: true || 1
        },
      });

      const availableCount = await UserSubProp.count({
        where: {
          userId: req.params.id,
          displayStatus: true || 1,
          saleStatus: 0
        },
      })

      const bookCount = await UserSubProp.count({
        where: {
          userId: req.params.id,
          displayStatus: true || 1,
          saleStatus: 1
        },
      })

      const soldCount = await UserSubProp.count({
        where: {
          userId: req.params.id,
          displayStatus: true || 1,
          saleStatus: 2
        },
      })

      const rentCount = await UserSubProp.count({
        where: {
          userId: req.params.id,
          displayStatus: true || 1,
          saleStatus: 3
        },
      })

      res.send({ data: data, count: count, availableCount: availableCount, bookCount: bookCount, soldCount: soldCount, rentCount: rentCount });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getAgents: async (req, res) => {
    try {

      let users = await sequelize.query(
        `
        SELECT users.id
        FROM users
        INNER JOIN user_account_details detail on detail.userId = users.id
        INNER JOIN user_sub_props on user_sub_props.userId = users.id
        where (users.packageExpire > cast(now() as date) and users.packageId != 1 and users.displayStatus = 1) or (users.packageId = 1 and users.displayStatus = 1)
        ORDER BY users.packageId desc
        `
      )

      users = users[0]
      let userId = []
      users.forEach((user) => {
        userId.push(user.id)
      })
      
      userId = userId.filter((id, index) => {
        return userId.indexOf(id) === index
      })

      const response = await Users.findAll({
        attributes: ["id", "displayName", "fname", "lname", "pictureUrl"],
        where: {
          id: { [Op.in]: userId }
        },
        include: [
          {
            model: UserAccountDetails,
            attributes: ["email", "phone", "organization"],
          },
          {
            model: UserSubProp,
            attributes: ['id'],
            where: { displayStatus: true || 1 }
          }
        ],
        order: [['packageId', 'desc']]
      });
      let agents = [];
      for (let i = 0; i < response.length; i++) {
        let data = {};
        data.id = response[i].id;
        data.displayName = response[i].displayName;
        data.fname = response[i].fname;
        data.lname = response[i].lname;
        if (response[i].pictureUrl != null && response[i].pictureUrl != '') {
          data.picture = `${HOST}/images/avatar/${response[i].pictureUrl}`;
        } else {
          data.picture = `${HOST}/images/avatar/default.jpg`;
        }
        data.email = response[i].user_account_detail["email"];
        data.phone = response[i].user_account_detail["phone"];
        data.organization = response[i].user_account_detail["organization"];
        data.count = response[i].user_sub_props.length
        agents.push(data);
      }

      res.send({ data: agents });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const id = res.locals.userId;

      let response = await Users.findOne({
        where: {
          id: id,
        },
        attributes: [
          "id",
          "displayName",
          "fname",
          "lname",
          "pictureUrl",
          "subscriptionPeriodId",
        ],
        include: [
          {
            model: Package,
          },
        ],
      });

      let detail = await UserAccountDetails.findOne({
        where: {
          userId: id,
        },
        attributes: ["email", "phone", "organization"],
      });

      let data = {};
      data.id = response.id;
      data.displayName = response.displayName;
      data.fname = response.fname;
      data.lname = response.lname;
      if (response.pictureUrl != null && response.pictureUrl != '') {
        data.picture = `${HOST}/images/avatar/${response.pictureUrl}`;
      } else {
        data.picture = `${HOST}/images/avatar/default.jpg`;
      }
      if (detail) {
        data.email = detail.email;
        data.phone = detail.phone;
        data.organization = detail.organization;
      } else {
        data.email = "";
        data.phone = "";
        data.organization = "";
      }

      const package = {};
      package.id = response.package.id;
      package.name = response.package.name;
      package.description = response.package.description;
      package.propertyLimit = response.package.propertyLimit;
      package.period = response.subscriptionPeriodId;
      if (response.subscriptionPeriodId == 1) {
        package.price = response.package.price1M;
      } else if (response.subscriptionPeriodId == 2) {
        package.price = response.package.price3M;
      } else if (response.subscriptionPeriodId == 3) {
        package.price = response.package.price6M;
      }

      res.send({ data: data, package: package });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  updateUserProfile: async (req, res) => {
    try {
      // console.log(req.body);
      const id = res.locals.userId;

      const user = await Users.update(
        {
          displayName: req.body.displayName,
          fname: req.body.fname,
          lname: req.body.lname,
        },
        {
          where: {
            id: id,
          },
        }
      );
      const existDetail = await UserAccountDetails.findOne({
        where: {
          userId: id,
        },
      });
      if (existDetail) {
        const detail = await UserAccountDetails.update(
          {
            email: req.body.email,
            phone: req.body.phone,
            organization: req.body.organization,
          },
          {
            where: {
              userId: id,
            },
          }
        );
      } else {
        const detail = await UserAccountDetails.create({
          userId: id,
          email: req.body.email,
          phone: req.body.phone,
          organization: req.body.organization,
        });
      }

      // test response
      res.send({ message: "ALERT.UPDATED_PROFILE" });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  updateAvatar: async (req, res) => {
    try {
      const id = res.locals.userId;
      const img = req.body.gallery[0];

      let oldPic = await Users.findOne({
        where: {
          id: id,
        },
        attributes: ["pictureUrl"],
      });

      if (oldPic.pictureUrl !=  null && oldPic.pictureUrl != '') {
        try {
          let absolutePath = path.resolve(
            "public/images/avatar/" + oldPic.pictureUrl
          );
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(String(absolutePath));
          }
        } catch (error) {
          console.log("image does not exist");
        }
      }

      const response = await Users.update(
        {
          pictureUrl: img,
        },
        {
          where: {
            id: id,
          },
        }
      );
      res.send({ message: "ALERT.UPDATED_AVATAR" });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getAccountBasic: async (req, res) => {
    try {
      const id = res.locals.userId;
      let response = await Users.findOne({
        where: {
          id: id,
        },
        attributes: ["displayName", "pictureUrl"],
      });

      if (response.pictureUrl != null && response.pictureUrl != '') {
        response.pictureUrl = `${HOST}/images/avatar/${response.pictureUrl}`;
      } else {
        response.pictureUrl = `${HOST}/images/avatar/default.jpg`;
      }

      res.send({ name: response.displayName, img: response.pictureUrl });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  checkFavorite: async (req, res) => {
    try {
      const id = res.locals.userId;

      const existFavorite = await UserFavorite.findOne({
        where: {
          userId: id,
          propertyId: req.params.propertyId,
        },
      });

      if (existFavorite) {
        res.send({ check: true });
      } else {
        res.send({ check: false });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  checkCompare: async (req, res) => {
    try {
      const id = res.locals.userId;

      const existCompare = await UserCompare.findOne({
        where: {
          userId: id,
          propertyId: req.params.propertyId,
        },
      });

      if (existCompare) {
        res.send({ check: true });
      } else {
        res.send({ check: false });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  userReportProperty: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const propertyId = req.params.propertyId;

      const existReport = await UserReportProperty.findOne({
        where: {
          userId: userId,
          propertyId: propertyId,
        },
      });

      if (existReport) {
        return res.send({
          status: 2,
          message: "ALERT.EXIST_REPORTED_PROPERTY",
        }); //status 2 is for report already exists
      } else {
        const addReport = await UserReportProperty.create({
          userId: userId,
          propertyId: propertyId,
          detailReportId: req.body.detailReportId,
          description: req.body.description,
        });

        res.send({
          status: 1,
          message: "ALERT.REPORTED_PROPERTY",
        }); // status 1 is for submitted report successfully
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getUserPackageId: async (req, res) => {
    try {
      const userId = res.locals.userId;

      const getPackageIdandSubsctiprionPeriodId = await Users.findOne({
        where: {
          id: userId,
        },
        attributes: ["packageId", "subscriptionPeriodId"],
      });
      res.send({ status: 1, data: getPackageIdandSubsctiprionPeriodId });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  userCreateRequirementPost: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const purposeId = req.body.purposeId;
      const typeId = req.body.typeId;
      const subDistrictId = req.body.subDistrictId;

      //  console.log(req.body);

      const existPost = await UserRequirement.findOne({
        where: {
          userId: userId,
          purposeId: purposeId,
          typeID: typeId,
          subDistrictId: subDistrictId,
        },
      });

      //  console.log(existPost);
      if (existPost) {
        return res.send({ status: 2, message: "ALERT.EXIST_REQUIREMENT" });
      } else {
        const createPost = await UserRequirement.create({
          userId: userId,
          purposeId: purposeId,
          typeId: typeId,
          subDistrictId: subDistrictId,
        });

        return res.send({ status: 1, message: "ALERT.CREATED_REQUIREMENT" });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getUserRequirementPost: async (req, res) => {
    try {
      const userId = res.locals.userId;

      let post = await sequelize.query(
        `
        select user_requirements.id as id,
               user_requirements.subDistrictId,
               user_requirements.purposeId,
               user_requirements.typeId,
               provinces.id as provinceId,
               provinces.name_th as province_nameth,
               provinces.name_en as province_nameen,
               districts.id as districtId,
               districts.name_th as district_nameth,
               districts.name_en as district_nameen,
               subdistricts.name_th as subDistrict_nameth,
               subdistricts.name_en as subDistrict_nameen,
               property_purposes.name_th as purpose_nameth,
               property_purposes.name_en as purpose_nameen,
               property_types.name_th as type_nameth,
               property_types.name_en as type_nameen
        
        from user_requirements
        inner join subdistricts on subdistricts.id = user_requirements.subDistrictId
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join property_types on property_types.id = user_requirements.typeId
        inner join property_purposes on property_purposes.id = user_requirements.purposeId

        where userId = ${userId}

        order by id desc
        `
      );

      post = post[0];

      return res.send({ status: 1, data: post });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  removeRequirementPostById: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const postId = req.params.postId;
      const remove = await UserRequirement.destroy({
        where: {
          userId: userId,
          id: postId,
        },
      });

      return res.send({ status: 1, message: "ALERT.DELETED_REQUIREMENT" });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  editRequirementPostById: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const postId = req.params.postId;
      const purposeId = req.body.purposeId;
      const typeId = req.body.typeId;
      const subDistrictId = req.body.subDistrictId;

      const existPost = await UserRequirement.findOne({
        where: {
          userId: userId,
          purposeId: purposeId,
          typeID: typeId,
          subDistrictId: subDistrictId,
        },
      });

      if (existPost) {
        return res.send({ status: 2, message: "ALERT.EXIST_REQUIREMENT" });
      } else {
        const editPost = await UserRequirement.update(
          {
            purposeId: purposeId,
            typeId: typeId,
            subDistrictId: subDistrictId,
          },
          {
            where: {
              userId: userId,
              id: postId,
            },
          }
        );

        return res.send({ status: 1, message: "ALERT.EDITED_REQUIREMENT" });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  clearAllRequirementPost: async (req, res) => {
    try {
      const userId = res.locals.userId;

      const clear = await UserRequirement.destroy({
        where: {
          userId: userId,
        },
      });

      return res.send({ status: 1, message: "ALERT.CLEAR_REQUIREMENT" });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getRequirementPostByAgentId: async (req, res) => {
    try {
      const userId = req.params.userId;

      let post = await sequelize.query(
        `
        select user_requirements.id as id,
               user_requirements.subDistrictId,
               user_requirements.purposeId,
               user_requirements.typeId,
               provinces.id as provinceId,
               provinces.name_th as province,
               districts.id as districtId,
               districts.name_th as district,
               subdistricts.name_th as subDistrict,
               property_purposes.name_th as purpose,
               property_types.name_th as type
        
        from user_requirements
        inner join subdistricts on subdistricts.id = user_requirements.subDistrictId
        inner join districts on subdistricts.DistrictId = districts.id 
        inner join provinces on districts.ProvinceId = provinces.id
        inner join property_types on property_types.id = user_requirements.typeId
        inner join property_purposes on property_purposes.id = user_requirements.purposeId

        where userId = ${userId}

        order by id desc
        `
      );

      post = post[0];
      res.send({ status: 1, data: post });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  checkUserAndAgentSame: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const agentId = req.params.agentId;

      if (userId == agentId) {
        return res.send({ status: 2 }); // status 2 is for user and agent is same person (can't report yourself)
      } else {
        return res.send({ status: 1 }); // status 1 mean user and agent is not the same person
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  userReportAgent: async (req, res) => {
    try {
      const userId = res.locals.userId;
      const agentId = req.params.agentId;

      const existReport = await UserReportUser.findOne({
        where: {
          userId: userId,
          userReportedId: agentId,
        },
      });

      if (existReport) {
        return res.send({
          status: 2,
          message: "ALERT.EXIST_REPORTED_USER",
        });
      } else {
        const reportUser = await UserReportUser.create({
          userId: userId,
          userReportedId: agentId,
          detailReportId: req.body.detailReportId,
          description: req.body.description,
        });
        return res.send({
          status: 1,
          message: "ALERT.REPORTED_USER",
        });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  userBuyPackage: async (req, res) => {
    try {
      // console.log(req.body);

      let userId = res.locals.userId;

      let picture = "";
      if (req.body.gallery) {
        picture = req.body.gallery[0];
      }

      let createPayment = await MoneyTransfer.create({
        userId: userId,
        packageId: req.body.packageId,
        periodId: req.body.periodId,
        price: req.body.price,
        pictureUrl: picture,
        dateTransfer: String(req.body.paymentTime),
        confirm: 0,
      });

      const user = await MoneyTransfer.findOne({
        where: {
          userId: userId,
          packageId: req.body.packageId,
          periodId: req.body.periodId,
          price: req.body.price,
          pictureUrl: picture,
          dateTransfer: req.body.paymentTime,
        },
        include: [
          {
            model: Users,
            attributes: ['displayName']
          },
          {
            model: Package,
            attributes: ['name']
          },
          {
            model: SubscriptionPeriod,
            attributes: ['period']
          }
        ]
      })
      let date = new Date(user.dateTransfer).toLocaleString();
      let message= {
        id: user.id,
        user: user.user.displayName,
        package: user.package.name,
        period: user.subscription_period.period,
        price: user.price,
        date: date
      }

      let slipImage = `${NGROK}/images/payment/${picture}`;
      lineNotify.notify({
        message: `
แจ้งโอนสลิป
ชื่อผู้ใช้: ${message.user}
แพ็คเกจ: ${message.package}
ระยะเวลา: ${message.period} เดือน
ราคา: ${message.price}
โอนเมื่อ: ${message.date}
${ADMIN_PATH}/realEstate/money-transfer/${message.id}`,
        imageThumbnail: slipImage,
        imageFullsize: slipImage,
      });
      return res.send({
        status: 1,
        message: "คุณชำระเงินเสร็จเรียบร้อยแล้ว กรุณารอการตรวจสอบสักครู่..",
      });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  getUserPackageExpire: async (req, res) => {
    try {
      const userId = res.locals.userId;

      const checkExpire = await Users.findOne({
        where: {
          id: userId,
        },
      });

      if (checkExpire.packageId == 1) {
        res.send({ status: 2 }); // status 2 is for users use free package
      } else {
        res.send({ status: 1, data: checkExpire.packageExpire }); // status 1 is for other package exclude free package
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  userCancelPackage: async (req, res) => {
    try {
      const userId = res.locals.userId;
      // console.log(userId);
      let userProperty = await UserSubProp.findAll({
        where: {
          userId: userId,
        },
        attributes: ["id"],
        order: [["createdAt", "asc"]],
      });

      let propertyId = [];
      userProperty.forEach((prop) => {
        propertyId.push(prop.id);
      });
      propertyId.pop();

      let disableProperties = await UserSubProp.update({
        displayStatus: false,
      },
       {
        where: {
          userId: userId,
          id: { [Op.in]: propertyId }
        }
       })

       let resetPackage = await Users.update({
        packageId: 1
       },
       {
        where: {
          id: userId
        }
       })

      return res.send({ status: 1, message: 'ALERT.CANCELED_PACKAGE_SUCCESS'});
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

};
