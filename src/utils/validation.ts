import * as Yup from "yup";

// Nigerian mobile in local format, the same rule the API applies (NigerianPhoneNumber): 0, then
// 7/8/9, then 0/1, then 8 more digits - e.g. 08012345678. Phone inputs only accept digits.
const phoneRegex = /^0[789][01][0-9]{8}$/;

export const registerStepOneSchema = Yup.object({
  fullName: Yup.string()
    .trim()
    .min(2, "Enter your full name")
    .required("Full name is required"),
  email: Yup.string()
    .trim()
    .email("Enter a valid email address")
    .required("Email is required"),
  phone: Yup.string()
    .trim()
    .matches(phoneRegex, "Enter an 11-digit phone number, e.g. 08012345678")
    .required("Phone number is required"),
});

export const registerStepTwoSchema = Yup.object({
  businessName: Yup.string()
    .trim()
    .min(2, "Enter your shop or business name")
    .max(100, "Keep it under 100 characters")
    .required("Shop/Business name is required"),
  password: Yup.string()
    .min(8, "Use at least 8 characters")
    .required("Create a password"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords do not match")
    .required("Confirm your password"),
  acceptedTerms: Yup.boolean().oneOf(
    [true],
    "You must accept the Terms and Privacy Notice",
  ),
});

export const loginSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email("Enter a valid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
});

export const phoneLoginSchema = Yup.object({
  phone: Yup.string()
    .trim()
    .matches(phoneRegex, "Enter an 11-digit phone number, e.g. 08012345678")
    .required("Phone number is required"),
});

export const phonePasswordLoginSchema = phoneLoginSchema.shape({
  password: Yup.string().required("Password is required"),
});

export const otpSchema = Yup.object({
  code: Yup.string()
    .matches(/^[0-9]{6}$/, "Enter the 6-digit code")
    .required("Enter the code we sent you"),
});

export const resetPasswordSchema = Yup.object({
  newPassword: Yup.string()
    .min(8, "Use at least 8 characters")
    .required("Create a new password"),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords do not match")
    .required("Confirm your new password"),
});

/** The field that's required depends on how the user chose to receive the code. */
export const forgotPasswordSchema = Yup.object({
  channel: Yup.mixed<"Email" | "Phone">().oneOf(["Email", "Phone"]).required(),
  email: Yup.string().when("channel", {
    is: "Email",
    then: (schema) =>
      schema
        .trim()
        .email("Enter a valid email address")
        .required("Email address is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  phone: Yup.string().when("channel", {
    is: "Phone",
    then: (schema) =>
      schema
        .trim()
        .matches(phoneRegex, "Enter an 11-digit phone number, e.g. 08012345678")
        .required("Phone number is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
});

export const createListingSchema = Yup.object({
  title: Yup.string()
    .trim()
    .min(5, "Give your listing a more descriptive title")
    .required("Title is required"),
  price: Yup.string()
    .trim()
    .matches(/^[0-9]+$/, "Enter a valid amount in Naira")
    .required("Price is required"),
  categoryId: Yup.string().required("Choose a category"),
  // Optional: an ad can sit directly in its category; picking a subcategory just files it more precisely.
  subcategoryId: Yup.string().notRequired(),
  condition: Yup.string()
    .oneOf(["New", "Used"], "Choose the item's condition")
    .required("Choose the item's condition"),
  description: Yup.string()
    .trim()
    .min(10, "Add a bit more detail for buyers")
    .required("Description is required"),
});

export const updatePasswordSchema = Yup.object({
  currentPassword: Yup.string().required("Enter your current password"),
  newPassword: Yup.string()
    .min(8, "Use at least 8 characters")
    .notOneOf([Yup.ref("currentPassword")], "Choose a different password")
    .required("Enter a new password"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords do not match")
    .required("Confirm your new password"),
});
