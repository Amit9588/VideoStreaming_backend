import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessandRefreshToken = async (userID) => {
    try {
        const user = await User.findById(userID);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();


        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false});



        return { accessToken, refreshToken };

    }catch (error) {
        throw new ApiError(500, "Error while generating access and refresh token");
    }

}





const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend

    const { fullName, email, username, password } = req.body; 
    // validate user details
    if (
        [fullName, email, username, password].some((field) =>  field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }
    // check if user already exists
    const Existeduser = await User.findOne({ 
        $or: [{ email }, { username }]
     });

    if (Existeduser) {
        throw new ApiError(409, "User with same email or username already exists");
    }
    // check for images, check for avatar

   /// Check avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
  }

// Check cover image (optional)
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    // upload to cloudinary, avatar check

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Error while uploading avatar");
    }




    //  create user object - create entry in db,
    const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || ""
});

    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");
    
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }
    //remove password and refresh token from response, send response to frontend
    //check for user creation 
    // return res 
    return res.status(201).json(new ApiResponse(201, "User created successfully", createdUser));
    

})


const loginUser = asyncHandler(async (req, res) => {
    // 1. Get user details from request body
    const { email, username, password } = req.body;

    // 2. Validate input
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    // 3. Find user in database
    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 4. Check password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // 5. Generate access and refresh tokens
    const { accessToken, refreshToken } =
        await generateAccessandRefreshToken(user._id);

    // 6. Fetch user without sensitive fields
    const loggedUser = await User.findById(user._id)
        .select("-password -refreshToken");

    // 7. Cookie options
    const options = {
        httpOnly: true,
        secure: true
    };

    // 8. Send response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );
});

   
const loggedout = asyncHandler (async(req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },{
            new : true
        }
    )

    const options ={
        httpOnly : true,
        secure : true
    }

    return res.
    status(200).
    clearCookie("accessToken", options).
    clearCookie("refreshToken", options).
    json(new ApiResponse(200, {}, "User logged out"))
   

})

const refreshAccessToken = asyncHandler(async(req,res) =>{
    const incomingrefreshtoken = req.cookies.refreshToken || req.body.refreshToken


    if(!incomingrefreshtoken) {
        throw new ApiError(401, "Unautorized RefreshToken request")
    }

    try {
        const decodedToken = jwt.verify(incomingrefreshtoken, process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)

    if(!user) {
        throw new ApiError(401, "Unauthorized Request")
    }

    if(!incomingrefreshtoken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired")

    }

    const options = {
        httpOnly : true,
        secure : true
    }

    const {accessToken, newrefreshToken} = await generateAccessandRefreshToken(user._id)

    return res.
    status(200).
    cookie("accessToken", accessToken, options).
    cookie("refreshToken" , newrefreshToken, options).
    json(
        new ApiResponse(
            200,
            {
                accessToken, refreshToken : newrefreshToken
                
            },
            "Access token refreshed"
        )
    )
    } catch (error) {
        throw new ApiError(401, error?.message || "invaild refresh token" )
    }}
)

export { registerUser , loginUser, loggedout , refreshAccessToken};