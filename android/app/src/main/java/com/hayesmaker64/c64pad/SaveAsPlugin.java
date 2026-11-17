package com.hayesmaker64.c64pad;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * "Save as": Android's own file picker (Storage Access Framework) to choose a
 * folder and name, then the bytes are written there. The share sheet has no
 * "save to device" target on many tablets, so this is how files reach
 * Downloads, Documents, Drive and so on.
 */
@CapacitorPlugin(name = "SaveAs")
public class SaveAsPlugin extends Plugin {

    /** save({ filename, data: base64 }) -> { saved: boolean, uri?: string } */
    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        if (filename == null || data == null) {
            call.reject("filename and data are required");
            return;
        }
        // While the picker is open Capacitor keeps the call's options in the
        // activity's saved state, which goes through Binder (~500 KB limit):
        // a big project crashed the app with TransactionTooLargeException.
        // So park the bytes in a cache file and keep only its path.
        File pending;
        try {
            pending = File.createTempFile("save-as-", ".bin", getContext().getCacheDir());
            try (OutputStream out = new FileOutputStream(pending)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
        } catch (Exception e) {
            call.reject("Could not prepare the file: " + e.getMessage(), e);
            return;
        }
        call.getData().remove("data");
        call.getData().put("pending", pending.getAbsolutePath());

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // octet-stream keeps the name as given: with a real MIME type some
        // providers append its extension ("project.c64pad.json").
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String path = call.getString("pending");
        File pending = path != null ? new File(path) : null;
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null || pending == null) {
            if (pending != null) pending.delete();
            JSObject ret = new JSObject();
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        new Thread(() -> {
            try {
                // "wt": truncate, in case an existing file was picked.
                try (
                    InputStream in = new FileInputStream(pending);
                    OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")
                ) {
                    if (out == null) throw new java.io.IOException("Could not open " + uri);
                    byte[] buffer = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
                }
                JSObject ret = new JSObject();
                ret.put("saved", true);
                ret.put("uri", uri.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not save the file: " + e.getMessage(), e);
            } finally {
                pending.delete();
            }
        }).start();
    }
}
