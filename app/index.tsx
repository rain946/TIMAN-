import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pawTop}>🐾</Text>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>TIMAN</Text>

        <Text style={styles.subtitle}>
          A Healthier Tomorrow{"\n"}For Brighter Tails
        </Text>
      </View>

      <View style={styles.imageContainer}>
        <View style={styles.greenShape} />

        <Image
          source={require("../assets/images/pets.png")}
          style={styles.petImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.tagline}>
        <Text style={styles.taglineText}>Same QR. A Safer, Happier Life.</Text>
      </View>

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

      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account? </Text>

        <Pressable
          style={({ pressed }) => [
            styles.loginAction,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginLink}>Log In</Text>
        </Pressable>
      </View>

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
    backgroundColor: "#FFF5E9",
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
    color: "#2E7D6B",
    letterSpacing: 2,
  },

  subtitle: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 28,
    color: "#56B091",
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
    backgroundColor: "#CFE8DD",
    bottom: 5,
  },

  petImage: {
    width: 320,
    height: 300,
  },

  tagline: {
    alignSelf: "center",
    backgroundColor: "#56B091",
    paddingVertical: 11,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: -10,
  },

  taglineText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  button: {
    height: 58,
    backgroundColor: "#2E7D6B",
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
    color: "#2E3A34",
    fontSize: 16,
  },

  loginLink: {
    color: "#2E7D6B",
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  loginAction: {
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
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
    color: "#2E7D6B",
  },
});
