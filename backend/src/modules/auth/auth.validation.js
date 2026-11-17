import { body, validationResult } from "express-validator";

export const registrationValidation = [
  body("first_name")
    .trim()
    .notEmpty()
    .withMessage("First name is required.")
    .isLength({ max: 80 })
    .withMessage("First name cannot exceed 80 characters."),

  body("last_name")
    .trim()
    .notEmpty()
    .withMessage("Last name is required.")
    .isLength({ max: 80 })
    .withMessage("Last name cannot exceed 80 characters."),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .isLength({ max: 30 })
    .withMessage("Phone number is too long."),

  body("password")
    .isString()
    .withMessage("Password must be a string.")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters."),

  body("role")
    .isIn(["customer", "erander", "both"])
    .withMessage("Choose customer, erander, or both."),
];

export function handleRegistrationValidation(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Please check your registration details.",
      errors: errors.array().map(({ path, msg }) => ({
        field: path,
        message: msg,
      })),
    });
  }

  next();
}
