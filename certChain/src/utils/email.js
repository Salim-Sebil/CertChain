function sendPasswordResetEmail(email, resetLink) {
  const message = `
    Hello,

    Your CertChain account has been created. Use the temporary password below to sign in and set a new password.

    Password reset link: ${resetLink}

    If you did not request this, ignore this email.
  `;

  console.log(`[email] Password reset requested for ${email}`);
  console.log(`[email] ${resetLink}`);

  return {
    delivered: true,
    email,
    resetLink,
    message,
  };
}

module.exports = { sendPasswordResetEmail };
