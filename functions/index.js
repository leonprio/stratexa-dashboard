/**
 * Cloud Functions for Tablero IPS - Prior Consultoría
 * Includes admin functions for user management
 */

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

// Initialize Firebase Admin
initializeApp();

// Global options for cost control
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

/**
 * Cloud Function to update a user's password
 * Only callable by authenticated admins
 */
exports.updateUserPassword = onCall(async (request) => {
    // Verify caller is authenticated
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debe estar autenticado para realizar esta acción.");
    }

    const { targetUserId, newPassword } = request.data;

    // Validate inputs
    if (!targetUserId || !newPassword) {
        throw new HttpsError("invalid-argument", "Se requiere el ID del usuario y la nueva contraseña.");
    }

    if (newPassword.length < 6) {
        throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
    }

    // Verify caller is an admin in Firestore
    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();

    if (!callerDoc.exists) {
        throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    }

    const callerData = callerDoc.data();
    if (callerData.globalRole !== "Admin") {
        throw new HttpsError("permission-denied", "Solo los administradores pueden cambiar contraseñas.");
    }

    // Prevent changing own password through this function
    if (targetUserId === request.auth.uid) {
        throw new HttpsError("invalid-argument", "Use la opción de cambio de contraseña personal para su propia cuenta.");
    }

    try {
        // Update password using Admin SDK
        await getAuth().updateUser(targetUserId, {
            password: newPassword,
        });

        return { success: true, message: "Contraseña actualizada correctamente." };
    } catch (error) {
        console.error("Error updating password:", error);

        if (error.code === "auth/user-not-found") {
            throw new HttpsError("not-found", "Usuario no encontrado en Firebase Auth.");
        }

        throw new HttpsError("internal", "Error al actualizar la contraseña: " + error.message);
    }
});

/**
 * Cloud Function to delete a user completely (Auth + Firestore)
 * Only callable by authenticated admins
 */
/**
 * Cloud Function to create a new user
 * Only callable by authenticated admins
 */
exports.createUser = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debe estar autenticado para realizar esta acción.");
    }

    const { email, password, displayName } = request.data;

    // Validate inputs
    if (!email || !password) {
        throw new HttpsError("invalid-argument", "Se requiere email y contraseña.");
    }

    if (password.length < 6) {
        throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
    }

    // Verify caller is an admin
    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();

    if (!callerDoc.exists || callerDoc.data().globalRole !== "Admin") {
        throw new HttpsError("permission-denied", "Solo los administradores pueden crear usuarios.");
    }

    try {
        // Create user using Admin SDK (doesn't affect client session)
        const userRecord = await getAuth().createUser({
            email: email,
            password: password,
            displayName: displayName || email.split('@')[0],
        });

        return {
            success: true,
            uid: userRecord.uid,
            message: "Usuario creado correctamente."
        };
    } catch (error) {
        console.error("Error creating user:", error);

        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "Este correo ya está registrado.");
        }
        if (error.code === "auth/invalid-email") {
            throw new HttpsError("invalid-argument", "El correo electrónico no es válido.");
        }
        if (error.code === "auth/weak-password") {
            throw new HttpsError("invalid-argument", "La contraseña es muy débil.");
        }

        throw new HttpsError("internal", "Error al crear usuario: " + error.message);
    }
});

exports.deleteUserCompletely = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debe estar autenticado para realizar esta acción.");
    }

    const { targetUserId } = request.data;

    if (!targetUserId) {
        throw new HttpsError("invalid-argument", "Se requiere el ID del usuario a eliminar.");
    }

    // Verify caller is an admin
    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();

    if (!callerDoc.exists || callerDoc.data().globalRole !== "Admin") {
        throw new HttpsError("permission-denied", "Solo los administradores pueden eliminar usuarios.");
    }

    // Prevent self-deletion
    if (targetUserId === request.auth.uid) {
        throw new HttpsError("invalid-argument", "No puede eliminar su propia cuenta.");
    }

    try {
        // Delete from Auth
        await getAuth().deleteUser(targetUserId);

        // Delete from Firestore
        await db.collection("users").doc(targetUserId).delete();

        return { success: true, message: "Usuario eliminado completamente." };
    } catch (error) {
        console.error("Error deleting user:", error);

        if (error.code === "auth/user-not-found") {
            // User not in Auth, just delete from Firestore
            await db.collection("users").doc(targetUserId).delete();
            return { success: true, message: "Usuario eliminado de la base de datos." };
        }

        throw new HttpsError("internal", "Error al eliminar usuario: " + error.message);
    }
});
