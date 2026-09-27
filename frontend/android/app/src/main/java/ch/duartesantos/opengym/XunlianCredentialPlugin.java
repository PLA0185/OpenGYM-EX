package ch.duartesantos.opengym;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name="XunlianCredential")
public class XunlianCredentialPlugin extends Plugin {
    private static final String ALIAS="xunlian.deepseek.v1";
    private SecretKey key() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);
        KeyGenerator kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return kg.generateKey();
    }
    @PluginMethod public void set(PluginCall call) {
        try {
            String value=call.getString("value","");
            if(value.length()>512){call.reject("Invalid credential");return;}
            android.content.SharedPreferences.Editor pref=getContext().getSharedPreferences("xunlian-secure",Context.MODE_PRIVATE).edit();
            if(value.isEmpty()){pref.clear().commit();call.resolve();return;}
            Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());
            byte[] encrypted=c.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            if(!pref.putString("iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP)).putString("data",Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit())throw new Exception();
            call.resolve();
        }catch(Exception e){call.reject("Secure storage unavailable");}
    }
    @PluginMethod public void get(PluginCall call) {
        try {
            android.content.SharedPreferences pref=getContext().getSharedPreferences("xunlian-secure",Context.MODE_PRIVATE);
            String data=pref.getString("data",null),value="";
            if(data!=null){Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(pref.getString("iv",""),Base64.NO_WRAP)));value=new String(c.doFinal(Base64.decode(data,Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);}
            JSObject result=new JSObject();result.put("value",value);call.resolve(result);
        }catch(Exception e){call.reject("Credential unavailable; enter it again");}
    }
}
