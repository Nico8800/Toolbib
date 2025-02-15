# curl -X POST \
#   http://localhost:8000/chat \
#   -H "Content-Type: application/json" \
#   -d '{"message": "does my patient have brain tumor? please explain why", "image": "tumor.jpg"}'

curl -X POST \
  http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "i wanna check the latest prohibited antibiotic for pregnant women"}'
