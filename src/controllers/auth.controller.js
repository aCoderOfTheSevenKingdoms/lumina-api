import User from "../models/user.model.js";
import { sendEmail } from "../services/mail.service.js";
import jwt from "jsonwebtoken";
import { verifyEmailTemplate } from "../templates/verifyEmail.template.js";

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = await User.create({ username, email, password });

    const emailVerificationToken = jwt.sign({
      email: user.email
    }, process.env.JWT_SECRET);

    const verificationLink = `${process.env.BASE_URL}/api/auth/verify-email?token=${emailVerificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Welcome to Lumina",
      html: verifyEmailTemplate({username: user.username, verificationLink})
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

export async function verifyEmail(req, res) {
  try {
    const {token} = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({email: decoded.email});
    if(!user) {
      return res.status(400).json({
        message: "Invalid token",
        success: false,
        err: "User not found"
      });
    }

    user.verified = true;
    await user.save();

    const successHtml = `
      <h1>Email verified successfully</h1>
      <p>Your email has been verified. You can now log in to your account.</p>  
    `; 

    return res.send(successHtml);
  } catch(error) {
    return res.status(500).json({
      message: error.message || "Internal server error"
    });
  }
}

export async function login(req, res) {
  try {
    const {email, password} = req.body;
    const user = await User.findOne({email});

    if(!user) {
      return res.status(401).json({
        message: "Invalid email or password",
        success: false,
        err: "Invalid credentials"
      });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if(!isPasswordMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
        success: false,
        err: "Incorrect password"
      });
    }

    if(!user.verified) {
      return res.status(400).json({
        message: "Please verify your email before logging in",
        success: false,
        err: "Email not verified"
      });
    }

    const token = jwt.sign({
      id: user._id,
      username: user.username 
    }, process.env.JWT_SECRET, {expiresIn: '7d'});

    res.cookie("token", token);

    return res.status(200).json({
      message: "Login successful",
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch(error) {
    return res.status(500).json({
      message: error.message || "Internal server error"
    })
  }
}

export async function getMe(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-password");
    if(!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
        erR: "User not found"
      });
    }
    return res.status(200).json({
      message: "User details fetched successfuly",
      success: true,
      user
    })
  } catch(error) {
    return res.status(500).json({message: error.message || "Internal server error"});
  }
}