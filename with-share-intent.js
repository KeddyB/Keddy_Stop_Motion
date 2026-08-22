const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAndroidShareIntent(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const packageDir = path.join(
        projectRoot,
        "app/src/main/java/com/keddyb/keddyStopMotion"
      );

      if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, { recursive: true });
      }

      // 1. Write ShareIntentModule.kt
      const moduleContent = `package com.keddyb.keddyStopMotion

import android.content.ContentResolver
import android.content.Intent
import android.database.Cursor
import android.media.ExifInterface
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern

class ShareIntentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ShareIntentModule"
        const val NAME = "ShareIntentModule"

        private var initialSharedMedia: WritableArray? = null
        private var instance: ShareIntentModule? = null

        fun handleInitialIntent(intent: Intent?, contentResolver: ContentResolver) {
            if (intent == null) return
            val items = parseIntentMedia(intent, contentResolver)
            if (items.size() > 0) {
                initialSharedMedia = items
            }
        }

        fun handleNewIntent(intent: Intent?, contentResolver: ContentResolver) {
            if (intent == null) return
            val items = parseIntentMedia(intent, contentResolver)
            if (items.size() > 0) {
                initialSharedMedia = items
                instance?.emitSharedMedia(items)
            }
        }

        private fun parseIntentMedia(intent: Intent, contentResolver: ContentResolver): WritableArray {
            val array = Arguments.createArray()
            val action = intent.action ?: return array

            val uris = mutableListOf<Uri>()

            if (Intent.ACTION_SEND == action) {
                val streamUri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                }

                if (streamUri != null) {
                    uris.add(streamUri)
                } else if (intent.data != null) {
                    uris.add(intent.data!!)
                } else if (intent.clipData != null && intent.clipData!!.itemCount > 0) {
                    for (i in 0 until intent.clipData!!.itemCount) {
                        val itemUri = intent.clipData!!.getItemAt(i).uri
                        if (itemUri != null) uris.add(itemUri)
                    }
                }
            } else if (Intent.ACTION_SEND_MULTIPLE == action) {
                val streamUris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                }

                if (streamUris != null) {
                    uris.addAll(streamUris)
                } else if (intent.clipData != null) {
                    for (i in 0 until intent.clipData!!.itemCount) {
                        val itemUri = intent.clipData!!.getItemAt(i).uri
                        if (itemUri != null) uris.add(itemUri)
                    }
                }
            }

            for (uri in uris) {
                val map = Arguments.createMap()
                val uriString = uri.toString()
                map.putString("uri", uriString)

                val fileName = getFileName(uri, contentResolver)
                map.putString("fileName", fileName)

                val timestamp = getMediaCreationTimestamp(uri, fileName, contentResolver)
                map.putDouble("timestamp", timestamp.toDouble())

                array.pushMap(map)
            }

            return array
        }

        private fun getFileName(uri: Uri, contentResolver: ContentResolver): String {
            var fileName = ""
            if (ContentResolver.SCHEME_CONTENT == uri.scheme) {
                var cursor: Cursor? = null
                try {
                    cursor = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                    if (cursor != null && cursor.moveToFirst()) {
                        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (index != -1) {
                            fileName = cursor.getString(index) ?: ""
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to get display name: \${e.message}")
                } finally {
                    cursor?.close()
                }
            }
            if (fileName.isEmpty()) {
                fileName = uri.lastPathSegment ?: "photo_\${System.currentTimeMillis()}.jpg"
            }
            return fileName
        }

        private fun getMediaCreationTimestamp(uri: Uri, fileName: String, contentResolver: ContentResolver): Long {
            if (ContentResolver.SCHEME_CONTENT == uri.scheme) {
                var cursor: Cursor? = null
                try {
                    val projection = arrayOf(
                        MediaStore.Images.Media.DATE_TAKEN,
                        MediaStore.Images.Media.DATE_MODIFIED,
                        MediaStore.Images.Media.DATE_ADDED
                    )
                    cursor = contentResolver.query(uri, projection, null, null, null)
                    if (cursor != null && cursor.moveToFirst()) {
                        val dateTakenIdx = cursor.getColumnIndex(MediaStore.Images.Media.DATE_TAKEN)
                        if (dateTakenIdx != -1) {
                            val dateTaken = cursor.getLong(dateTakenIdx)
                            if (dateTaken > 0) return dateTaken
                        }

                        val dateModIdx = cursor.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED)
                        if (dateModIdx != -1) {
                            val dateMod = cursor.getLong(dateModIdx)
                            if (dateMod > 0) return dateMod * 1000L
                        }

                        val dateAddIdx = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
                        if (dateAddIdx != -1) {
                            val dateAdd = cursor.getLong(dateAddIdx)
                            if (dateAdd > 0) return dateAdd * 1000L
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "MediaStore query failed: \${e.message}")
                } finally {
                    cursor?.close()
                }
            }

            var inputStream: InputStream? = null
            try {
                inputStream = contentResolver.openInputStream(uri)
                if (inputStream != null) {
                    val exif = ExifInterface(inputStream)
                    val dateStr = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
                        ?: exif.getAttribute(ExifInterface.TAG_DATETIME_DIGITIZED)
                        ?: exif.getAttribute(ExifInterface.TAG_DATETIME)

                    if (dateStr != null) {
                        val sdf = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.getDefault())
                        val parsed = sdf.parse(dateStr)
                        if (parsed != null) return parsed.time
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "ExifInterface read failed: \${e.message}")
            } finally {
                try {
                    inputStream?.close()
                } catch (_: Exception) {}
            }

            val pattern1 = Pattern.compile("(\\\\d{4})(\\\\d{2})(\\\\d{2})_(\\\\d{2})(\\\\d{2})(\\\\d{2})")
            val matcher1 = pattern1.matcher(fileName)
            if (matcher1.find()) {
                try {
                    val cal = Calendar.getInstance()
                    cal.set(
                        matcher1.group(1)!!.toInt(),
                        matcher1.group(2)!!.toInt() - 1,
                        matcher1.group(3)!!.toInt(),
                        matcher1.group(4)!!.toInt(),
                        matcher1.group(5)!!.toInt(),
                        matcher1.group(6)!!.toInt()
                    )
                    return cal.timeInMillis
                } catch (_: Exception) {}
            }

            val pattern2 = Pattern.compile("(\\\\d{13})")
            val matcher2 = pattern2.matcher(fileName)
            if (matcher2.find()) {
                try {
                    val epoch = matcher2.group(1)!!.toLong()
                    if (epoch in 946684800000L..2524608000000L) {
                        return epoch
                    }
                } catch (_: Exception) {}
            }

            return System.currentTimeMillis()
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun getInitialSharedMedia(promise: Promise) {
        try {
            val media = initialSharedMedia
            initialSharedMedia = null
            promise.resolve(media ?: Arguments.createArray())
        } catch (e: Exception) {
            promise.reject("ERR_GET_SHARED_MEDIA", e.message, e)
        }
    }

    @ReactMethod
    fun clearSharedMedia(promise: Promise) {
        initialSharedMedia = null
        promise.resolve(true)
    }

    fun emitSharedMedia(items: WritableArray) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onSharedMediaReceived", items)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}
}
`;
      fs.writeFileSync(
        path.join(packageDir, "ShareIntentModule.kt"),
        moduleContent,
        "utf8"
      );

      // 2. Write ShareIntentPackage.kt
      const packageContent = `package com.keddyb.keddyStopMotion

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ShareIntentPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ShareIntentModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
      fs.writeFileSync(
        path.join(packageDir, "ShareIntentPackage.kt"),
        packageContent,
        "utf8"
      );

      // 3. Patch MainActivity.kt
      const mainActivityPath = path.join(packageDir, "MainActivity.kt");
      if (fs.existsSync(mainActivityPath)) {
        let contents = fs.readFileSync(mainActivityPath, "utf8");
        if (!contents.includes("ShareIntentModule.handleInitialIntent")) {
          contents = contents.replace(
            "super.onCreate(null)",
            "super.onCreate(null)\n    ShareIntentModule.handleInitialIntent(intent, contentResolver)"
          );
        }
        if (!contents.includes("override fun onNewIntent")) {
          contents = contents.replace(
            "class MainActivity : ReactActivity() {",
            "class MainActivity : ReactActivity() {\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n    ShareIntentModule.handleNewIntent(intent, contentResolver)\n  }"
          );
        }
        if (!contents.includes("import android.content.Intent")) {
          contents = "package com.keddyb.keddyStopMotion\n\nimport android.content.Intent\n" + contents.replace("package com.keddyb.keddyStopMotion", "");
        }
        fs.writeFileSync(mainActivityPath, contents, "utf8");
      }

      // 4. Patch MainApplication.kt
      const mainApplicationPath = path.join(packageDir, "MainApplication.kt");
      if (fs.existsSync(mainApplicationPath)) {
        let contents = fs.readFileSync(mainApplicationPath, "utf8");
        if (!contents.includes("add(ShareIntentPackage())")) {
          contents = contents.replace(
            "PackageList(this).packages.apply {",
            "PackageList(this).packages.apply {\n          add(ShareIntentPackage())"
          );
          fs.writeFileSync(mainApplicationPath, contents, "utf8");
        }
      }

      return config;
    },
  ]);
}

module.exports = function withShareIntentPlugin(config) {
  return withAndroidShareIntent(config);
};
