import qrcode
import io
import base64

def generate_emergency_qr_base64(user_id: str, frontend_url: str) -> str:
    """
    Generates a QR code for the user's emergency profile and returns it as a base64 string.
    """
    url = f"{frontend_url}/emergency/{user_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#b91c1c", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    
    base64_encoded = base64.b64encode(img_bytes).decode('utf-8')
    return f"data:image/png;base64,{base64_encoded}"
