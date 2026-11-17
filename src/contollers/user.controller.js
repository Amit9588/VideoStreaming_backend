import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadonCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    // upload to cloudinary, avatar check

    const avatar = await uploadonCloudinary(avatarLocalPath, "avatar");
    const coverImage = await uploadonCloudinary(coverImageLocalPath, "coverImage");

    if (!avatar) {
        throw new ApiError(400, "Error while uploading avatar");
    }




    //  create user object - create entry in db,
    User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url || "",
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }
    //remove password and refresh token from response, send response to frontend
    //check for user creation 
    // return res 
    return res.status(201).json(new ApiResponse(201, "User created successfully", createdUser));
    

})

export { registerUser };