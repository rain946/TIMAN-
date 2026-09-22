import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative paw */}
      <Text style={styles.pawTop}>🐾</Text>

      {/* APP NAME */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>TIMAN</Text>

        <Text style={styles.subtitle}>
          A Healthier Tomorrow{"\n"}For Brighter Tails
        </Text>
      </View>

      {/* PET IMAGE */}
      <View style={styles.imageContainer}>
        <View style={styles.greenShape} />

        <Image
          source={require("../assets/images/pets.png")}
          style={styles.petImage}
          resizeMode="contain"
        />
      </View>

      {/* TAGLINE */}
      <View style={styles.tagline}>
        <Text style={styles.taglineText}>
          Same QR. A Safer, Happier Life.
        </Text>
      </View>

      {/* GET STARTED */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => router.push("/register")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
        <Text style={styles.arrow}>→</Text>
      </Pressable>

      {/* LOGIN */}
      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>
          Already have an account?{" "}
        </Text>

        <Pressable onPress={() => router.push("/login")}>
          <Text style={styles.loginLink}>Log In</Text>
        </Pressable>
      </View>

      {/* BOTTOM DECORATION */}
      <View style={styles.bottomDecoration}>
        <Text style={styles.bottomPaw}>🐾</Text>
        <Text style={styles.bottomHeart}>♡</Text>
        <Text style={styles.bottomPaw}>🐾</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFDF7",
    paddingHorizontal: 25,
    paddingTop: 20,
  },

  pawTop: {
    position: "absolute",
    top: 40,
    left: 25,
    fontSize: 42,
    opacity: 0.18,
  },

  titleContainer: {
    alignItems: "center",
    marginTop: 65,
  },

  title: {
    fontSize: 58,
    fontWeight: "900",
    color: "#145A32",
    letterSpacing: 2,
  },

  subtitle: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 25,
    color: "#194D33",
    fontWeight: "500",
  },

  imageContainer: {
    height: 310,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  greenShape: {
    position: "absolute",
    width: 300,
    height: 230,
    borderRadius: 100,
    backgroundColor: "#DCEEDC",
    bottom: 5,
  },

  petImage: {
    width: 320,
    height: 300,
  },

  tagline: {
    alignSelf: "center",
    backgroundColor: "#27663D",
    paddingVertical: 11,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: -10,
  },

  taglineText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  button: {
    height: 58,
    backgroundColor: "#176B3A",
    borderRadius: 15,
    marginTop: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 28,
    position: "absolute",
    right: 25,
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  loginText: {
    color: "#335C46",
    fontSize: 14,
  },

  loginLink: {
    color: "#145A32",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  bottomDecoration: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 15,
    opacity: 0.18,
  },

  bottomPaw: {
    fontSize: 35,
  },

  bottomHeart: {
    fontSize: 45,
    color: "#145A32",
  },
});
