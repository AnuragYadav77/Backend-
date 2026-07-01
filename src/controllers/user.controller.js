import {asyncHandler} from "../utils/async-handler.js"

import {ApiError} from "../utils/ApiError.js"

import {User} from "../models/user.model.js"

import {uploadOnCloudinary} from "../utils/cloudinary.js"

import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessandRefreshTokens = async(userId)=>{
    try {
       const user =  await User.findById(userId)
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()
       
       user.refreshToken = refreshToken
       await user.save({validateBeforeSave: false})

       return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}


const registerUser = asyncHandler(async(req,res)=>{
    //1.get user details from frontend
    //2.validation - not empty
    //3.check if user already exists:username,email
    //4.check fro images, check for avatar
    //5.uplaod them to cloudinary,avatar.
    //6.create user object - create entry in db
    //7.remove password and refreshToken field from response
    //8.check for user creation
    //9.return res(if created),otherwise return error
    
    //1
    const{fullName,email,username,password}=req.body
    console.log("email:",email);
    
    //2
    if(
       [fullName,email,username,password].some((field)=>field?.trim()=== "") 
    ){
        throw new ApiError(400,"All fields are required")
    }

    //3
    const existedUser = await User.findOne({
        $or : [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }
    // console.log(req.files)

    //4
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    //5
    const avatar =   await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    //6
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    //check if the user has successfully been created or not
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //8
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    //9.
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )



})

 // user-login
const loginUser= asyncHandler(async(req,res)=>{
   //todos to login a user
   //1.req body ->data
   //2.username/email
   //3.find the user
   //4.(if user found) password check
   //5.(correct password) access and refresh token
   //6.send tokens (cookies)

   //1
   const {username,email,password} = req.body
   //2
   if(!password || (!username && !email)){
    throw new ApiError(400,"username or email and password are required")
   }
   
   //3
   const user = await User.findOne({
    //using mongoDB operator - '$'
    $or:[{username},{email}] //finding the user based on either username or email.
   })

   if (!user) {
       throw new ApiError(404,"user does not exist")
   }

   //4
   const isPasswordValid=  await user.isPasswordCorrect(password)
   if (!isPasswordValid) {
       throw new ApiError(401,"Invalid Password")
   }

   //5
   const {accessToken,refreshToken} = await generateAccessandRefreshTokens(user._id)

   //6
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   //sending cookies
   const options = {
    httpOnly:true, //now these cookies are modifiable from server side only(not from frontend)
    secure:true

}
return res
.status(200)
.cookie("accessToken",accessToken,options)
.cookie("refreshToken",refreshToken,options)
.json(
    new ApiResponse(
        200,
        {
            user:loggedInUser,
            accessToken,
            refreshToken
        },
        "User logged In Successfully"
    )
)
  

})

//logging-out user
const logoutUser  = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
    req.user._id, //finding the user
    {
        $set:{
            refreshToken: undefined
        }
    },
    {
        new :true
    }
   )
    const options = {
    httpOnly:true,
    secure:true

}
return res
.status(200)
.clearCookie("accessToken",options)
.clearCookie("refreshToken",options)
.json(new ApiResponse(200,{},"User logged out"))

})

export {
    registerUser,
    loginUser,
    logoutUser
}