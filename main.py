from flask import Flask, jsonify, request, render_template, url_for, send_file, redirect, Response, abort, stream_with_context, session
from flask_session import Session
import requests
import io
import json
import shutil
import os, urllib.parse
from datetime import datetime
from downloader import is_valid_url, get_download_options
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.config.update({
    'SESSION_TYPE': 'filesystem',
    'SECRET_KEY': 'Mr_anas123',
    'SESSION_PERMANENT': False,
    'PERMANENT_SESSION_LIFETIME': 1800,  # 30 minutes
})

Session(app)

Session(app)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Length", "Content-Disposition"]
    }
})

# Configure app settings
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = None

# Add required security headers
@app.after_request
def add_header(response):
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    return response



@app.route('/')
def index():
    return render_template('index.html')


@app.route('/validate_url', methods=["POST"])
def validate_url():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"valid": False, "error": "URL cannot be empty."})
    
    valid = is_valid_url(url)
    if not valid:
        return jsonify({"valid": False, "error": "Invalid URL."})
        
    # Get options here and store in session
    try:
        options = get_download_options(url)
        options = json.loads(json.dumps(options, default=str))  # Ensure serializable
        
        # Check if formats are available
        has_video = options.get('available_v_resolutions') and len(options['available_v_resolutions']) > 0
        has_audio = options.get('available_a_extensions') and len(options['available_a_extensions']) > 0
        
        if not (has_video or has_audio):
            return jsonify({"valid": False, "error": "URL not supported!, Please try again or use different URL."})
            
        # Store in session if valid
        session['options'] = options
        return jsonify({"valid": True, "error": None})
        
    except Exception as e:
        return jsonify({"valid": False, "error": "URL not supported!, Please try again or use different URL."})
    

@app.route('/download-options', methods=["GET"])
def download_opt():
    url = request.args.get("url")
    if not url or not is_valid_url(url):
        return redirect(url_for("index"))

    # Use options from session instead of fetching again
    options = session.get('options')
    if not options:
        return redirect(url_for("index"))
        
    return render_template("download-opt.html", options=options)


# Backend (Python/Flask)
def stream_video_response(url, filename):
    try:
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Range': 'bytes=0-'
        }
        
        # First make a HEAD request to get the content length
        head_response = session.head(url, headers=headers, timeout=10)
        total_size = int(head_response.headers.get('content-length', 0))
        content_type = head_response.headers.get('Content-Type', 'application/octet-stream')

        
        downloaded_size = 0
        
        def generate():
            nonlocal downloaded_size
            with session.get(url, headers=headers, stream=True) as response:
                if not response.ok:
                    # print(f"Stream error: {response.status_code}")
                    return
                
                # Stream the content in chunks
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        downloaded_size += len(chunk)
                        yield chunk
        
        response = Response(
            generate(),
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': content_type,
                'Content-Length': str(total_size),
                'Accept-Ranges': 'bytes'
            }
        )
        
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=["POST"])
def download():
    try:
        data = request.get_json()
        url = data.get("url")
        extension = data.get("extension")
        title = data.get("title", "video")

        encoded_title = urllib.parse.quote(title)
        filename = f"{encoded_title}.{extension}"
        
        
        if not url:
            return jsonify({"error": "URL is required"}), 400
            
        return stream_video_response(url, filename)
        
    except Exception as e:

        return jsonify({"error": str(e)}), 500
    

@app.route('/download-thumbnail')
def download_thumbnail():
    thumbnail_url = request.args.get('url')
    title = request.args.get('title', 'thumbnail')

    try:
        response = requests.get(thumbnail_url)
        response.raise_for_status()
        img_io = io.BytesIO(response.content)
        return send_file(
            img_io,
            as_attachment=True,
            download_name=f"{title}_thumbnail.jpg",
            mimetype='image/jpeg'
        )
    except Exception as e:
        return Response(str(e), status=400)
    


# Use to get file size in GB, MB instead of bytes 
def format_file_size(size_in_bytes):
    if size_in_bytes >= (1024 * 1024 * 1024): 
        return f"{round(size_in_bytes / (1024 * 1024 * 1024), 2)}Gb"
    elif size_in_bytes >= (1024 * 1024):
        return f"{round(size_in_bytes / (1024 * 1024))}Mb"
    elif size_in_bytes >= (1024):
        return f"{round(size_in_bytes / (1024))}Kb"
    else:
        return f"{size_in_bytes}B"
    


@app.route('/get-rec-video-info', methods=["POST"])
def get_rec_video_info():
    data = request.get_json()
    resolution = data.get("resolution")
    extension = data.get("extension")

    if not resolution or not extension:
        return jsonify({"error": "Resolution and extension are required"}), 400

    options = session.get('options', {})
    recommended_videos = options.get('recommended_videos', [])

    for v in recommended_videos:
        if str(v.get('resolution', '')).strip() == str(resolution).strip() and str(v.get('ext', '')).strip() == str(extension).strip():

            url = v.get('url')
            filesize = format_file_size(v.get('filesize'))
            title = options.get('title', 'downloaded_video')


            return jsonify({"url": url, "filesize": filesize, "title": title, "extension": extension, "type": "rec-video"})
    

    return jsonify({"error": "No video found for the specified resolution and extension"}), 404



# Helper to find preferred audio
def get_preferred_audio(options, preferred_extensions):
    best_audios = options.get('best_audios', [])
    for ext in preferred_extensions:
        audio = next((a for a in best_audios if a.get('url') and a.get('ext') == ext), None)
        if audio:
            audio_filesize = audio.get('filesize', 0)
            print("filesize of selected audio: ", audio.get('filesize'))
            return audio.get('url'), ext, audio_filesize
    # Fallback to the first available audio
    first_audio = next((a for a in best_audios if a.get('url')), None)
    return first_audio.get('url'), first_audio.get('ext') if first_audio else (None, None)

# Route for other video info
@app.route('/get-other-video-info', methods=["POST"])
def get_other_video_info():
    data = request.get_json()
    resolution = data.get("resolution")
    extension = data.get("extension")

    if not resolution or not extension:
        return jsonify({"error": "Resolution and extension are required"}), 400

    options = session.get('options', {})
    other_videos = options.get('other_videos', []) + options.get('recommended_videos', [])
    
    # Get preferred audio URL and extension
    preferred_extensions = ['m4a', 'mp3', 'webm']
    audio_url, audio_ext, audio_filesize = get_preferred_audio(options, preferred_extensions)


    # Find the matching video
    matching_video = next(
        (v for v in other_videos if str(v.get('resolution')).strip() == str(resolution).strip() and str(v.get('ext')).strip() == str(extension).strip()),
        None
    )

    if not matching_video:
        return jsonify({"error": "No video found for the specified resolution and extension"}), 404

    # Ensure video URL is present
    video_url = matching_video.get('url')
    total_filesize = format_file_size(matching_video.get('filesize', 0) + audio_filesize)

    print("FileSize of matching video: ", matching_video.get("filesize"))
    if not video_url:
        return jsonify({"error": "No matching video found. Please choose from recommended videos"}), 400

    return jsonify({
        "url": video_url,
        "audio_url": audio_url,
        "filesize": total_filesize,
        "title": options.get('title', 'downloaded_video'),
        "extension": extension,
        "type": "other-video",
        "audio_ext": audio_ext or "unknown"
    })



@app.route('/get-audio-info', methods=["POST"])
def get_audio_info():
    data = request.get_json()
    extension = data.get("extension")

    if not extension:
        return jsonify({"error": "Extension is required"}), 400

    options = session.get('options')

    for a in options['best_audios']:
        if extension in a['ext']:
            url = a.get('url')
            filesize = format_file_size(a.get('filesize'))

            title = options.get('title', f'downloaded_video.{extension}')
            return jsonify({"url": url, "filesize": filesize, "title": title, "extension": extension, "type": "audio"})

    return jsonify({"error": "Could not find the audio."}), 404


@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
