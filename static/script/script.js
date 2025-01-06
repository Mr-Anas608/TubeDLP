document.addEventListener('DOMContentLoaded', () => {
        
    const rec_downloadButton = document.getElementById('rec-download-button');
    const audio_downloadButton = document.getElementById('audio-download-button');
    const other_downloadButton = document.getElementById('other-download-button');

    // Progress bar utilities
    const DownloadProgress = {
        show: (message = 'Preparing your download...') => {
            const overlay = document.getElementById('overlay');
            const loaderText = document.getElementById('loader-text');
            const progressBar = document.getElementById('progress');
            const progressPercentage = document.getElementById('progress-percentage');
            
            overlay.style.display = 'flex';
            loaderText.innerText = message;
            progressBar.style.width = '0%';
            progressPercentage.innerText = '0%';
        },

        update: (progress, message) => {
            if (progress >= 0) {
                const progressBar = document.getElementById('progress');
                const progressPercentage = document.getElementById('progress-percentage');
                const loaderText = document.getElementById('loader-text');
                
                if (message) loaderText.innerText = message;
                progressBar.style.width = `${progress.toFixed(1)}%`;
                progressPercentage.innerText = `${progress.toFixed(1)}%`;
            }
        },

        hide: () => {
            document.getElementById('overlay').style.display = 'none';
        }
    };

    // Trigger a file download in the browser
    const downloadFile = ({ blob, filename }) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    // Improved FFmpeg merger with progress tracking and dynamic extension handling
    async function mergeBlobs(videoBlob, audioBlob, outputFormat, progressCallback) {
        const { createFFmpeg, fetchFile } = FFmpeg;
        const ffmpeg = createFFmpeg({ 
            log: false,
            progress: ({ ratio }) => {
                if (progressCallback) {
                    progressCallback(ratio * 100);
                }
            }
        });

        try {
            await ffmpeg.load();    


            // Write files to FFmpeg virtual filesystem
            ffmpeg.FS('writeFile', 'video.mp4', await fetchFile(videoBlob));
            ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioBlob));

            // Choose the correct audio codec based on the output format
            let audioCodec = 'aac';  // Default codec
            if (outputFormat === 'webm') {
                audioCodec = 'libvorbis';
            }

            // Set dynamic output file name
            const outputFile = `output.${outputFormat}`;

            // Merge with optimized settings
            await ffmpeg.run(
                '-i', 'video.mp4',
                '-i', 'audio.mp3',
                '-c:v', 'copy',
                '-c:a', audioCodec,
                '-shortest',
                '-y', 

                outputFile
            );

            // Read the merged file
            const mergedData = ffmpeg.FS('readFile', outputFile);

            // Cleanup
            ffmpeg.FS('unlink', 'video.mp4');
            ffmpeg.FS('unlink', 'audio.mp3');
            ffmpeg.FS('unlink', outputFile);

            // Return the merged blob
            return new Blob([mergedData.buffer], { type: `video/${outputFormat}` });
        } catch (error) {
            console.error('Merge failed:', error);
            throw new Error(`Merging failed: ${error.message}`);
        }
    }





    // Enhanced file fetching with better progress tracking
    async function fetchFileWithProgress(videoInfo, progressCallback) {
        const { url, title, extension } = videoInfo;
        
        try {
            const response = await fetch("/download", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, title, extension })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Download preparation failed');
            }

            const contentLength = parseInt(response.headers.get('Content-Length'), 10);
            const filename = response.headers.get('filename') || `${title}.${extension}`;
            
            if (!response.body) throw new Error('Response body is empty');

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                if (value) {
                    chunks.push(value);
                    receivedLength += value.length;
                    
                    if (progressCallback && contentLength) {
                        const progress = (receivedLength / contentLength) * 100;
                        progressCallback(progress);
                    }
                }
            }

            // Combine chunks into final blob
            const blob = new Blob(chunks, { 
                type: response.headers.get('Content-Type') || 'application/octet-stream' 
            });

            return { blob, filename };
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }


    // Fetch and process download information
    const fetchDownloadInfo = async (route, data) => {
        const response = await fetch(route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch data');
        }

        return response.json();
    };


    // --- Function to handle timeout logic ---
    function handleDownloadTimeout(downloadStarted) {
        const downloadTimeout = setTimeout(() => {
            if (!downloadStarted.value) {
                DownloadProgress.hide();
                alert('Download failed to start. Please try again.');
            }
        }, 20000); // Set 20-second timeout
        return downloadTimeout;
    }


    // Function to handle the download timeout
    function handleDownloadTimeout(callback, timeout = 20000) {
        let downloadStarted = false;

        // Start the timeout
        const downloadTimeout = setTimeout(() => {
            if (!downloadStarted) {
                DownloadProgress.hide();
                alert('Download failed to start. Please try again.');
            }
        }, timeout);

        // Return a function to update the flag and clear the timeout
        return (progress) => {
            if (progress > 0 && !downloadStarted) {
                downloadStarted = true;
                clearTimeout(downloadTimeout);
                callback(progress);
            } else if (downloadStarted) {
                callback(progress);
            }
        };
    }


    // Recommended Video Download Button
    if (rec_downloadButton) {
        rec_downloadButton.addEventListener('click', async () => {
            const resolution = document.querySelector('input[name="rec_resolution"]:checked')?.value;
            const extension = document.querySelector('input[name="rec_extension"]:checked')?.value;

            if (!resolution || !extension) {
                alert('Please select a resolution and extension.');
                return;
            }

            try {
                const videoInfo = JSON.parse(rec_downloadButton.dataset.info);

                DownloadProgress.show();

                const { blob, filename } = await fetchFileWithProgress(
                    videoInfo,
                    handleDownloadTimeout(progress => {
                        DownloadProgress.update(progress, 'Downloading video...');
                    })
                );

                DownloadProgress.hide();
                downloadFile({ blob, filename });
            } catch (error) {
                console.error("Download error:", error);
                DownloadProgress.hide();
                alert(`Error: ${error.message}`);
            }
        });
    }

    // Other Video Download Button
    if (other_downloadButton) {
        other_downloadButton.addEventListener('click', async () => {
            const resolution = document.querySelector('input[name="other_resolution"]:checked')?.value;
            const extension = document.querySelector('input[name="other_extension"]:checked')?.value;

            if (!resolution || !extension) {
                alert('Please select both resolution and extension.');
                return;
            }

            try {
                const videoInfo = JSON.parse(other_downloadButton.dataset.info);
                console.log("Video Info", videoInfo)
                const { url: video_url, audio_url, title, audio_ext = 'm4a' } = videoInfo;

                DownloadProgress.show();

                // Download video
                const { blob: videoBlob } = await fetchFileWithProgress(
                    { url: video_url, title, extension },
                    handleDownloadTimeout(progress => {
                        DownloadProgress.update(progress * 0.45, 'Downloading video...');
                    })
                );

                // Download audio
                DownloadProgress.update(45, 'Downloading audio...');
                const { blob: audioBlob } = await fetchFileWithProgress(
                    { url: audio_url, title, extension: audio_ext },
                    handleDownloadTimeout(progress => {
                        DownloadProgress.update(45 + progress * 0.45);
                    })
                );

                // Merge files
                DownloadProgress.update(90, 'Merging files...');
                const mergedBlob = await mergeBlobs(videoBlob, audioBlob, extension, progress => {
                    DownloadProgress.update(90 + progress * 0.1);
                });

                DownloadProgress.hide();
                downloadFile({ blob: mergedBlob, filename: `${title}_merged.${extension}` });
            } catch (error) {
                console.error("Other video download error:", error);
                DownloadProgress.hide();
                alert(`Error: ${error.message}`);
            }
        });
    }


    // Audio Download Button
    if (audio_downloadButton) {
        audio_downloadButton.addEventListener('click', async () => {
            const extension = document.querySelector('input[name="audio_extension"]:checked')?.value;

            if (!extension) {
                alert('Please select an audio extension.');
                return;
            }

            try {
                const audioInfo = JSON.parse(audio_downloadButton.dataset.info);

                DownloadProgress.show();

                const { blob, filename } = await fetchFileWithProgress(
                    audioInfo,
                    handleDownloadTimeout(progress => {
                        DownloadProgress.update(progress, 'Downloading audio...');
                    })
                );

                DownloadProgress.hide();
                downloadFile({ blob, filename });
            } catch (error) {
                console.error("Audio download error:", error);
                DownloadProgress.hide();
                alert(`Error: ${error.message}`);
            }
        });
    }

    const get_ButtonData = async (type, button) => {
        let endpoint, data;

        switch (type) {
            case 'audio':
                endpoint = '/get-audio-info';
                data = { extension: document.querySelector('input[name="audio_extension"]:checked')?.value };
                break;
            case 'rec':
                endpoint = '/get-rec-video-info';
                data = {
                    resolution: document.querySelector('input[name="rec_resolution"]:checked')?.value,
                    extension: document.querySelector('input[name="rec_extension"]:checked')?.value,
                };
                break;
            case 'other':
                endpoint = '/get-other-video-info';
                data = {
                    resolution: document.querySelector('input[name="other_resolution"]:checked')?.value,
                    extension: document.querySelector('input[name="other_extension"]:checked')?.value,
                };
                break;
            default:
                return;
        }

        try {
            const info = await fetchDownloadInfo(endpoint, data);
            button.dataset.info = JSON.stringify(info); // Store info in the dataset

            button.setAttribute('data-tooltip', `Size: ${info.filesize}`);
        } catch (error) {
            console.error(`Failed to fetch ${type} data:`, error);
        }
    };



    // For radio button event listeners
    document.querySelectorAll('input[name="rec_resolution"], input[name="rec_extension"], input[name="audio_extension"], input[name="other_resolution"], input[name="other_extension"]').forEach(input => {
        input.addEventListener('change', () => {
            
            if (input.name === "audio_extension" && audio_downloadButton) {
                get_ButtonData('audio', audio_downloadButton);
            } else if ((input.name === "rec_resolution" || input.name === "rec_extension") && rec_downloadButton) {
                get_ButtonData('rec', rec_downloadButton);
            } else if ((input.name === "other_resolution" || input.name === "other_extension") && other_downloadButton) {
                get_ButtonData('other', other_downloadButton);
            }
        });
    });


    // TO download thumbnail
    document.querySelector('.Btn').addEventListener('click', function () {
        const thumbnailImg = document.querySelector('.thumbnail img');
        const titleElement = document.querySelector('.thumbnail p:not(.p-else)');

        if (thumbnailImg && thumbnailImg.src) {
            const title = titleElement ? titleElement.textContent.trim() : 'untitled';
            const downloadUrl = `/download-thumbnail?url=${encodeURIComponent(thumbnailImg.src)}&title=${encodeURIComponent(title)}`;

            window.location.href = downloadUrl;
        }
    });


    // Initialize button data if elements exist
    const initializeButtonData = () => {
        const rec_resolution = document.querySelector('input[name="rec_resolution"]:checked')?.value;
        const rec_extension = document.querySelector('input[name="rec_extension"]:checked')?.value;
        if (rec_resolution && rec_extension && rec_downloadButton) {
            get_ButtonData('rec', rec_downloadButton);
        }

        const audio_extension = document.querySelector('input[name="audio_extension"]:checked')?.value;
        if (audio_extension && audio_downloadButton) {

            get_ButtonData('audio', audio_downloadButton);
        }

        const other_resolution = document.querySelector('input[name="other_resolution"]:checked')?.value;
        const other_extension = document.querySelector('input[name="other_extension"]:checked')?.value;
        if (other_resolution && other_extension && other_downloadButton) {
            get_ButtonData('other', other_downloadButton);
        }
    };

initializeButtonData();

});