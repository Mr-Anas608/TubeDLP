import yt_dlp, requests
from urllib.parse import urlparse
# Use get_best_video_options function to filter the best video formats
def get_best_video_options(formats):
    best_options = {}
    for f in formats:
        if not f.get("filesize"): # If not filesize, then will None, None means false, and not will evaluates false to true, 
            continue

        key = (f['resolution'], f['ext'])  # Group by resolution and extension
        if key not in best_options:
            best_options[key] = f
        else:
            # Compare based on quality (higher filesize preferred)
            current = best_options[key]
            if f['filesize'] >= current['filesize']:
                best_options[key] = f

    return list(best_options.values())

def sort_audio_formats(audio_formats):
    # Filter out None values and get all abr values
    abr_values = [f.get('abr') for f in audio_formats if f.get('abr') is not None]
    
    if not abr_values:
        return audio_formats
    
    # Calculate mean
    mean_abr = sum(abr_values) / len(abr_values)
    
    # Sort based on distance from mean, with preference for higher values
    def sort_key(format_dict):
        abr = format_dict.get('abr') or 0
        distance_from_mean = abs(abr - mean_abr)
        # For same distances, prefer higher values (negative sign for reverse sort)
        return (distance_from_mean, -abr)
    
    return sorted(audio_formats, key=sort_key)

# A function for get_download_options(), used to filter only the necessary information extracted with extract_info()
def filter_info(info):
    title = info.get("title")
    thumbnail = info.get("thumbnail")
    formats = info.get("formats")  # Formats is a list containing various video and audio formats in nested dictionaries.

    video_resolutions = [
    4320,  # 8K
    2160,  # 4K
    1440,  # 2k
    1080,  # Full HD
    720,   # HD
    480,   # Standard Definition
    360,
    240,
    144 ]

    # Define a mapping for resolutions with labels
    resolution_labels = {
    4320: "8K",
    2160: "4K",
    1440: "2K",
    1080: "Full HD",
    720: "HD"
    }

    # Extract Only Useful Formats
    
    # Skip all non-relevant formats 
    video_formats = [f for f in formats if f.get("vcodec") != 'none'] 
    audio_formats = [f for f in formats if f.get("vcodec") == 'none' and f.get("acodec") != 'none']

    # Get the best video formats based on resolution and extension
    video_formats = get_best_video_options(video_formats)


    recommended_videos = []  # Videos with both video and audio
    other_videos = []        # Videos without audio

    for f in video_formats:
        t = {}  # Temporary dictionary to hold filtered video format info

        if not f.get('filesize'):
            continue

        # Extract resolution as an integer (e.g., "1080" from "1920x1080")
        resolution = f.get("resolution", "0x0").split("x")[-1]
        resolution = int(resolution) if resolution.isdigit() else 0

        # Skip formats not in common resolutions
        if resolution not in video_resolutions:
            continue

        # Append 'p' to all resolutions and add labels for specific ones
        formatted_resolution = f"{resolution}p"
        if resolution in resolution_labels:
            formatted_resolution += f" ({resolution_labels[resolution]})"
        
        t["resolution"] = formatted_resolution

        # Use "filesize_approx" if "filesize" is unavailable, and use a function to covert bytes into GBs or MBs

        # t["filesize"] = format_file_size(f.get("filesize") or f.get("filesize_approx"))

        t["filesize"] = int(f.get("filesize")) or int(f.get("filesize_approx"))

    
        t["url"] = f.get("url")
        t["ext"] = f.get("ext")


        # Check for unique video formats by extension
        
         # Classify into recommended or other videos
        if f.get("acodec") != 'none':  # Video has audio
            recommended_videos.append(t)
        else:  # Video without audio
            other_videos.append(t)
                

    # Sort videos: recommended by resolution descending, other videos by resolution descending
    # Sorting recommended videos based on numeric resolution
    recommended_videos.sort(key=lambda x: int(x["resolution"].split("p")[0]), reverse=True)
 
    other_videos.sort(key=lambda x: int(x["resolution"].split("p")[0]), reverse=True)


    best_audios = []
    check = set()  # To store unique audio formats based on their extension
    audio_formats = sort_audio_formats(audio_formats)  # Sort audio formats by medium 'abr' formats by highest 'abr'

    for f in audio_formats: 
        t = {}  # Temporary dictionary to hold filtered audio format info
        if not f.get('filesize'):
            continue

        # t["filesize"] = format_file_size(f.get("filesize") or f.get("filesize_approx"))

        t["filesize"] = int(f.get("filesize")) or int(f.get("filesize_approx"))

        t["abr"] = f.get("abr")
        t["url"] = f.get("url")
        t["ext"] = f.get("ext")


        # Check for unique audio formats by extension
        if t["ext"] not in check:
            check.add(t["ext"])  # Add the extension to the set
            best_audios.append(t)  # Append the filtered audio to the best_audios list


  
    v_resolutions = {v.get("resolution") for v in other_videos }
    v_extensions = {v.get("ext") for v in other_videos}
    a_extensions = {a.get("ext") for a in best_audios}
    available_v_resolutions = sorted(list(v_resolutions), key=lambda x: int(x.split("p")[0]),reverse=True)


    # Return filtered information
    return {
        'title': title,
        'thumbnail': thumbnail,
        'recommended_videos': recommended_videos,
        'other_videos': other_videos,
        'best_audios' : best_audios,
        'available_v_resolutions': available_v_resolutions,
        'available_v_extensions': sorted(list(v_extensions), reverse=True),
        'available_a_extensions': sorted(list(a_extensions), reverse=True)
    }



# A function to extract download information using the extract_info() function in the YoutubeDL class from the yt_dlp library.
def get_download_options(url):
    options = {
        'no_warnings': True,
        'socket_timeout': 120,
        'cookies': 'cookies.txt',
        'username': 'mr.anasfb03@gmail.com',
        'password': '@Pasword_MrAnas03',  
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/'
        },
        'extract_flat': True,
        'quiet': True,
        'sleep_interval': 1,
        'max_sleep_interval': 5,
    }
    
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
            info_after_filter = filter_info(info)
            return info_after_filter
    except yt_dlp.utils.DownloadError as e:
        return {"error": f"The provided URL is not supported: {str(e)}"}
    except Exception as e:
        return {"error": f"An unexpected error occurred: {str(e)}"}


def is_valid_url(url):
    try:
        # Check if the URL is well-formed
        parsed = urlparse(url)
        if not (parsed.scheme and parsed.netloc):
            return False
        # Send a HEAD request to check if the URL is accessible
        response = requests.head(url, timeout=5)
        return response.status_code >= 200 and response.status_code < 400
    except (ValueError, requests.RequestException):
        return False
