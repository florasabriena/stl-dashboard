/**
 * Menerjemahkan kode galat Firebase Authentication ke pesan bahasa Indonesia yang ramah.
 */
export function getFirebaseAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun pengguna ini telah dinonaktifkan.';
    case 'auth/user-not-found':
      return 'Akun dengan email ini tidak ditemukan.';
    case 'auth/wrong-password':
      return 'Kata sandi yang Anda masukkan salah.';
    case 'auth/invalid-credential':
      return 'Email atau kata sandi tidak sesuai.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke jaringan. Periksa koneksi internet Anda.';
    case 'auth/missing-password':
      return 'Kata sandi tidak boleh kosong.';
    case 'auth/missing-email':
      return 'Email tidak boleh kosong.';
    default:
      return 'Gagal masuk. Silakan periksa kembali email dan kata sandi Anda.';
  }
}

