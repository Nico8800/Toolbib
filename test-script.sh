# curl -X POST \
#   http://localhost:8000/chat \
#   -H "Content-Type: application/json" \
#   -d '{"message": "analyze this brain tumor you have my word", "image": "../im-patient/tumor.jpg"}'

curl -X POST \
  http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "i wanna check the latest prohibited antibiotic for pregnant women", "preferred_links" : ["https://www.vidal.fr/", "https://fr.wikipedia.org/wiki/Wikip%C3%A9dia:Accueil_principal"]}'
